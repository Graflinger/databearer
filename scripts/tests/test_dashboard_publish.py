"""Offline publication integration tests using real Git and isolated bare origins.

Run: python3 -B -m unittest discover -s scripts/tests -p 'test_dashboard_publish.py' -v
Fixtures exercise publication policy; canonical data validation belongs upstream.
"""

from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from zoneinfo import ZoneInfo


SCRIPT = Path(__file__).resolve().parents[1] / "dashboard_publish.py"
RECENT = "frontend/src/_data/germanElectricity.json"
TRADE = "frontend/src/_data/germanElectricityTrade.json"
HISTORY = "frontend/src/data-history/german-electricity"
MANIFEST = f"{HISTORY}/manifest.json"
RELEASE = "releases/cloudflare"


class DashboardPublishTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="dashboard publish tests ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / "working tree"
        self.repo.mkdir()
        self.origin = self.root / "bare origin.git"
        self.env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        self.env.update(
            GIT_CONFIG_NOSYSTEM="1", GIT_CONFIG_GLOBAL=os.devnull,
            GIT_ALLOW_PROTOCOL="file", GIT_TERMINAL_PROMPT="0",
            GIT_AUTHOR_NAME="Fixture Author", GIT_AUTHOR_EMAIL="fixture@example.invalid",
            GIT_COMMITTER_NAME="Fixture Author", GIT_COMMITTER_EMAIL="fixture@example.invalid",
            PYTHONDONTWRITEBYTECODE="1",
        )
        self.git("init", "--bare", "--initial-branch=main", str(self.origin))
        self.git("init", "--initial-branch=main")
        self.git("remote", "add", "origin", str(self.origin))
        self.year = datetime.now(ZoneInfo("Europe/Berlin")).year
        self.write(".gitignore", ".data/\n")
        self.write("source file\twith a newline\n.py", "original source\n")
        self.write("frontend/src/css/style.css", "/* original */\n")
        self.write("frontend/src/_data/germanElectricityAnnual.json", "{}")
        self.write("frontend/src/_data/germanElectricityProgress.json", "{}")
        self.write(RECENT, '{"fixture":1}')
        self.write(TRADE, '{"fixture":1}')
        self.closed = self.partition(self.year - 1, "closed")
        self.current = self.partition(self.year, "current")
        self.retained = self.partition(self.year, "previous version")
        self.manifest = {
            "schema_version": 1, "kind": "german-electricity-history",
            "timezone": "Europe/Berlin", "source": {"name": "Fixture source"},
            "revision_policy": "Fixture policy", "first_date": f"{self.year - 1}-01-01",
            "last_date": f"{self.year}-01-01", "years": [self.closed, self.current],
        }
        self.write_json(MANIFEST, self.manifest)
        self.seed()

    def run_process(self, command, *, cwd=None, input=None):
        return subprocess.run(command, cwd=cwd or self.repo, env=self.env, input=input,
                              text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)

    def git(self, *args, cwd=None, input=None):
        result = self.run_process(["git", *args], cwd=cwd, input=input)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def cli(self, *args, success=True):
        result = self.run_process([sys.executable, "-B", str(SCRIPT), *args])
        self.assertEqual(result.returncode, 0 if success else 1, result.stdout + result.stderr)
        return result

    def write(self, path, value):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(value, encoding="utf-8")

    def write_json(self, path, value):
        self.write(path, json.dumps(value, sort_keys=True, separators=(",", ":")))

    def partition(self, year, label):
        value = {"schema_version": 1, "year": year, "timezone": "Europe/Berlin",
                 "source": {"name": "Fixture source"}, "rows": [{"fixture": label}]}
        raw = json.dumps(value, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(raw.encode()).hexdigest()
        self.write(f"{HISTORY}/{year}.{digest}.json", raw)
        closed = year < self.year
        days = 366 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 365
        return {"year": year, "sha256": digest,
                "url": f"/data/history/german-electricity/{year}.{digest}.json",
                "first_date": f"{year}-01-01", "last_date": f"{year}-12-31" if closed else f"{year}-01-01",
                "days": days if closed else 1, "frozen": closed}

    def path(self, entry):
        return f"{HISTORY}/" + entry["url"].rsplit("/", 1)[1]

    def seed(self):
        self.git("add", "--all")
        self.git("commit", "-m", "fixture: reviewed released base")
        self.git("push", "--atomic", "origin", "HEAD:refs/heads/main", f"HEAD:refs/heads/{RELEASE}")
        self.base = self.git("rev-parse", "HEAD")

    def remote_sha(self, branch):
        return self.git("rev-parse", f"refs/heads/{branch}", cwd=self.origin)

    def assert_unpublished(self):
        self.assertEqual(self.git("rev-parse", "HEAD"), self.base)
        for branch in ("main", RELEASE):
            self.assertEqual(self.remote_sha(branch), self.base)

    def rejected(self, reason):
        result = self.cli("publish", "--base", self.base, success=False)
        self.assertIn(reason, result.stderr)
        self.assertEqual(result.stdout, "")
        self.assert_unpublished()
        return result

    def change_recent(self):
        self.write(RECENT, '{"fixture":2}')

    def refreshed_history(self):
        fresh = self.partition(self.year, "refreshed")
        self.manifest["years"][-1] = fresh
        self.write_json(MANIFEST, self.manifest)
        return fresh

    def competing_commit(self):
        tree = self.git("rev-parse", f"{self.base}^{{tree}}", cwd=self.origin)
        return self.git("commit-tree", tree, "-p", self.base, "-m", "other writer", cwd=self.origin)

    def hook(self, name, body, *, bare=False):
        target = (self.origin if bare else self.repo / ".git") / "hooks" / name
        target.write_text("#!/bin/sh\nset -eu\n" + body + "\n", encoding="utf-8")
        target.chmod(0o755)

    def test_check_prints_only_full_base_sha(self):
        result = self.cli("check")
        self.assertEqual(result.stdout, self.base + "\n")
        self.assertEqual(result.stderr, "")
        self.assert_unpublished()
        self.assertEqual(self.git("status", "--porcelain"), "")

    def test_no_change_creates_no_commit_or_push_and_ignores_ignored_files(self):
        self.write(".data/temporary raw.json", "ignored")
        self.hook("pre-push", "exit 1")
        self.assertEqual(self.cli("check").stdout.strip(), self.base)
        result = self.cli("publish", "--base", self.base)
        self.assertEqual(result.stdout, f"unchanged {self.base}\n")
        self.assert_unpublished()

    def test_allowlisted_changes_commit_and_push_both_branches_with_retention(self):
        self.assertEqual(self.cli("check").stdout.strip(), self.base)
        self.change_recent()
        self.write(TRADE, '{"fixture":2}')
        fresh = self.refreshed_history()
        (self.repo / self.path(self.retained)).unlink()
        result = self.cli("publish", "--base", self.base)
        commit = self.git("rev-parse", "HEAD")
        self.assertEqual(result.stdout, f"published {commit}\n")
        self.assertNotEqual(commit, self.base)
        self.assertEqual(self.git("rev-list", "--parents", "-n", "1", "HEAD"), f"{commit} {self.base}")
        for branch in ("main", RELEASE):
            self.assertEqual(self.remote_sha(branch), commit)
        changed = set(self.git("diff", "--name-only", self.base, commit).splitlines())
        self.assertEqual(changed, {RECENT, TRADE, MANIFEST, self.path(fresh), self.path(self.retained)})
        self.assertEqual(self.git("log", "-1", "--format=%s"), "data: refresh German electricity dashboard")
        identity = self.git("log", "-1", "--format=%an%n%ae%n%cn%n%ce").splitlines()
        self.assertEqual(identity, ["github-actions[bot]",
                                   "41898282+github-actions[bot]@users.noreply.github.com"] * 2)
        self.assertEqual(self.git("status", "--porcelain"), "")
        self.assertTrue((self.repo / self.path(self.current)).is_file())

    def test_recent_only_change_is_allowed(self):
        self.change_recent()
        self.cli("publish", "--base", self.base)
        self.assertEqual(self.remote_sha("main"), self.git("rev-parse", "HEAD"))

    def test_main_ahead_is_rejected_before_refresh(self):
        self.write("new source.py", "unpublished")
        self.git("add", "--all")
        self.git("commit", "-m", "unpublished main")
        self.git("push", "origin", "HEAD:refs/heads/main")
        main = self.remote_sha("main")
        self.assertIn("must equal the base", self.cli("check", success=False).stderr)
        self.assertEqual(self.remote_sha(RELEASE), self.base)
        self.assertEqual(self.remote_sha("main"), main)

    def test_production_ahead_is_rejected_before_refresh(self):
        other = self.competing_commit()
        self.git("update-ref", f"refs/heads/{RELEASE}", other, self.base, cwd=self.origin)
        self.assertIn("must equal the base", self.cli("check", success=False).stderr)
        self.assertEqual(self.remote_sha("main"), self.base)
        self.assertEqual(self.remote_sha(RELEASE), other)

    def test_refetch_detects_main_advance_after_check(self):
        self.cli("check")
        self.change_recent()
        other = self.competing_commit()
        self.git("update-ref", "refs/heads/main", other, self.base, cwd=self.origin)
        self.assertIn("must equal the base", self.cli("publish", "--base", self.base, success=False).stderr)
        self.assertEqual(self.git("rev-parse", "HEAD"), self.base)
        self.assertEqual(self.remote_sha(RELEASE), self.base)
        self.assertEqual(self.remote_sha("main"), other)

    def test_refetch_detects_production_advance_after_check(self):
        self.cli("check")
        self.change_recent()
        other = self.competing_commit()
        self.git("update-ref", f"refs/heads/{RELEASE}", other, self.base, cwd=self.origin)
        self.assertIn("must equal the base", self.cli("publish", "--base", self.base, success=False).stderr)
        self.assertEqual(self.git("rev-parse", "HEAD"), self.base)
        self.assertEqual(self.remote_sha("main"), self.base)

    def test_wrong_branch_and_detached_head_are_rejected(self):
        self.git("switch", "-c", "review")
        self.assertIn("Expected checkout branch", self.cli("check", success=False).stderr)
        self.git("checkout", "--detach", self.base)
        self.cli("check", success=False)
        self.assert_unpublished()

    def test_expected_branch_override(self):
        self.git("switch", "-c", "review")
        self.assertEqual(self.cli("check", "--expected-branch", "review").stdout.strip(), self.base)

    def test_missing_remote_release_ref_is_rejected(self):
        self.git("update-ref", "-d", f"refs/heads/{RELEASE}", cwd=self.origin)
        self.cli("check", success=False)
        self.assertEqual(self.remote_sha("main"), self.base)

    def test_wrong_and_abbreviated_bases_are_rejected(self):
        self.rejected_base("a" * 40, "HEAD no longer")
        self.rejected_base(self.base[:12], "full commit SHA")

    def rejected_base(self, base, reason):
        self.assertIn(reason, self.cli("publish", "--base", base, success=False).stderr)
        self.assert_unpublished()

    def test_check_rejects_even_allowlisted_dirty_files(self):
        self.change_recent()
        self.assertIn("clean tracked/untracked", self.cli("check", success=False).stderr)
        self.assert_unpublished()

    def test_source_code_with_whitespace_path_is_rejected(self):
        self.write("source file\twith a newline\n.py", "changed")
        self.rejected("outside daily publication allowlist")

    def test_untracked_unknown_path_is_rejected(self):
        self.change_recent()
        self.write("untracked name\nwith spaces.json", "{}")
        self.rejected("outside daily publication allowlist")

    def test_rename_is_rejected(self):
        (self.repo / RECENT).rename(self.repo / "renamed data.json")
        self.rejected("outside daily publication allowlist")

    def test_generated_css_change_is_rejected(self):
        self.write("frontend/src/css/style.css", "/* modified */")
        self.rejected("outside daily publication allowlist")

    def test_annual_and_progress_changes_are_rejected(self):
        for name in ("Annual", "Progress"):
            with self.subTest(name=name):
                path = f"frontend/src/_data/germanElectricity{name}.json"
                self.write(path, '{"modified":true}')
                self.rejected("outside daily publication allowlist")
                self.git("restore", "--", path)

    def test_pre_staged_allowlisted_change_is_rejected_and_preserved(self):
        self.change_recent()
        self.git("add", "--", RECENT)
        index = self.git("write-tree")
        self.rejected("Pre-staged changes")
        self.assertEqual(self.git("write-tree"), index)

    def test_staged_change_hidden_by_worktree_revert_is_rejected(self):
        self.change_recent()
        self.git("add", "--", RECENT)
        self.write(RECENT, '{"fixture":1}')
        self.rejected("Pre-staged changes")

    def test_intent_to_add_is_rejected(self):
        fresh = self.refreshed_history()
        self.git("add", "--intent-to-add", "--", self.path(fresh))
        self.rejected("Pre-staged changes")

    def test_symlink_json_is_rejected(self):
        (self.repo / RECENT).unlink()
        (self.repo / RECENT).symlink_to("germanElectricityTrade.json")
        self.rejected("non-executable regular file")

    def test_executable_mode_is_rejected_even_with_filemode_disabled(self):
        (self.repo / RECENT).chmod(0o755)
        self.env.update(GIT_CONFIG_COUNT="1", GIT_CONFIG_KEY_0="core.filemode", GIT_CONFIG_VALUE_0="false")
        self.rejected("non-executable regular file")

    def test_new_partition_symlink_is_rejected(self):
        fresh = self.refreshed_history()
        path = self.repo / self.path(fresh)
        path.unlink()
        path.symlink_to(Path(self.path(self.current)).name)
        self.rejected("non-executable regular file")

    def test_frozen_partition_edits_and_deletions_are_rejected(self):
        path = self.path(self.closed)
        self.write(path, "{}")
        self.rejected("outside daily publication allowlist")
        (self.repo / path).unlink()
        self.rejected("outside daily publication allowlist")

    def test_closed_manifest_entries_cannot_change(self):
        mutations = {"sha256": "a" * 64, "url": "/elsewhere.json", "first_date": "2015-02-01",
                     "last_date": f"{self.year - 1}-12-30", "days": 1, "frozen": False}
        for key, value in mutations.items():
            with self.subTest(field=key):
                old = self.closed[key]
                self.closed[key] = value
                self.write_json(MANIFEST, self.manifest)
                self.cli("publish", "--base", self.base, success=False)
                self.assert_unpublished()
                self.closed[key] = old

    def test_valid_replacement_closed_partition_reference_is_rejected(self):
        replacement = self.partition(self.year - 1, "reconciled")
        # Even an already tracked retained version cannot replace a frozen entry.
        self.seed()
        self.manifest["years"][0] = replacement
        self.write_json(MANIFEST, self.manifest)
        self.rejected("Frozen history entry changed")

    def test_rollover_can_only_freeze_complete_immediately_previous_year(self):
        self.closed["frozen"] = False
        self.manifest["years"] = [self.closed]
        self.manifest["last_date"] = self.closed["last_date"]
        (self.repo / self.path(self.current)).unlink()
        (self.repo / self.path(self.retained)).unlink()
        self.write_json(MANIFEST, self.manifest)
        self.seed()
        self.closed["frozen"] = True
        fresh = self.partition(self.year, "first current-year partition")
        self.manifest["years"].append(fresh)
        self.manifest["last_date"] = fresh["last_date"]
        self.write_json(MANIFEST, self.manifest)
        self.cli("publish", "--base", self.base)
        self.assertEqual(self.remote_sha(RELEASE), self.git("rev-parse", "HEAD"))

    def test_rollover_missing_december_31_is_rejected(self):
        self.closed.update(frozen=False, last_date=f"{self.year - 1}-12-30", days=self.closed["days"] - 1)
        self.manifest["years"] = [self.closed]
        self.manifest["last_date"] = self.closed["last_date"]
        self.write_json(MANIFEST, self.manifest)
        self.seed()
        self.closed["frozen"] = True
        self.write_json(MANIFEST, self.manifest)
        self.rejected("lacks December 31")

    def test_future_year_file_is_rejected(self):
        self.partition(self.year + 1, "future")
        self.rejected("outside daily publication allowlist")

    def test_unreferenced_current_year_file_is_rejected(self):
        self.partition(self.year, "orphan")
        self.rejected("not referenced by the manifest")

    def test_ignored_new_partition_cannot_leave_a_dangling_manifest(self):
        fresh = self.refreshed_history()
        # Repository-local exclusions are ignored by status but must not permit
        # a manifest commit whose referenced partition is absent from Git.
        self.write(".git/info/exclude", self.path(fresh) + "\n")
        self.rejected("would not be committed")

    def test_current_filename_cannot_disguise_other_source_year(self):
        value = {"schema_version": 1, "year": self.year - 1, "timezone": "Europe/Berlin",
                 "source": self.manifest["source"], "rows": []}
        raw = json.dumps(value, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(raw.encode()).hexdigest()
        path = f"{HISTORY}/{self.year}.{digest}.json"
        self.write(path, raw)
        entry = dict(self.current, sha256=digest,
                     url=f"/data/history/german-electricity/{self.year}.{digest}.json")
        self.manifest["years"][-1] = entry
        self.write_json(MANIFEST, self.manifest)
        self.rejected("only the current Berlin year")

    def test_current_version_cannot_be_rewritten_in_place(self):
        self.write(self.path(self.retained), "{}")
        self.rejected("immutable")

    def test_immediately_preceding_manifest_version_cannot_be_deleted(self):
        self.refreshed_history()
        (self.repo / self.path(self.current)).unlink()
        self.rejected("Only superseded current-year retention")

    def test_manifest_metadata_or_extra_embedded_data_is_rejected(self):
        self.manifest["source"] = {"name": "Different source"}
        self.write_json(MANIFEST, self.manifest)
        self.rejected("manifest metadata changed")
        self.manifest["raw_source_data"] = [1, 2, 3]
        self.write_json(MANIFEST, self.manifest)
        self.rejected("Unexpected history manifest fields")

    def test_invalid_json_and_duplicate_keys_are_rejected(self):
        for raw in ("not json", '{"fixture":1,"fixture":2}', '{"fixture":NaN}'):
            with self.subTest(raw=raw):
                self.write(RECENT, raw)
                self.cli("publish", "--base", self.base, success=False)
                self.assert_unpublished()

    def test_commit_hook_failure_stops_without_pushing(self):
        self.change_recent()
        self.hook("pre-commit", "exit 1")
        self.rejected("git commit failed")

    def test_commit_hook_cannot_add_source_to_validated_commit(self):
        self.change_recent()
        self.hook("pre-commit", "printf 'hook source' > injected.py\ngit add -- injected.py")
        result = self.cli("publish", "--base", self.base, success=False)
        self.assertIn("Commit tree differs", result.stderr)
        for branch in ("main", RELEASE):
            self.assertEqual(self.remote_sha(branch), self.base)

    def test_remote_rejection_stops_without_bypass_or_partial_update(self):
        self.change_recent()
        self.hook("pre-receive", "exit 1", bare=True)
        result = self.cli("publish", "--base", self.base, success=False)
        self.assertIn("git push failed", result.stderr)
        for branch in ("main", RELEASE):
            self.assertEqual(self.remote_sha(branch), self.base)

    def test_atomic_push_race_updates_neither_branch_from_this_run(self):
        self.change_recent()
        other = self.competing_commit()
        # The pre-push hook runs after fetch and remote advertisement, creating an
        # actual non-fast-forward/ref-lock race in receive-pack, not a mock error.
        self.hook("pre-push", f'git --git-dir="{self.origin}" update-ref refs/heads/{RELEASE} {other} {self.base}')
        result = self.cli("publish", "--base", self.base, success=False)
        self.assertIn("git push failed", result.stderr)
        local = self.git("rev-parse", "HEAD")
        self.assertNotEqual(local, self.base)
        self.assertEqual(self.remote_sha("main"), self.base)
        self.assertEqual(self.remote_sha(RELEASE), other)
        self.assertNotEqual(self.remote_sha(RELEASE), local)
        self.assertIn("HEAD no longer", self.cli("publish", "--base", self.base, success=False).stderr)

    def test_non_fast_forward_main_race_leaves_production_at_base(self):
        self.change_recent()
        other = self.competing_commit()
        self.git("fetch", "origin", other)
        # Advance main after the final fetch but before push advertisement, so
        # Git rejects it as non-fast-forward and atomically refuses production.
        self.hook("post-commit", f'git --git-dir="{self.origin}" update-ref refs/heads/main {other} {self.base}')
        result = self.cli("publish", "--base", self.base, success=False)
        self.assertIn("git push failed", result.stderr)
        self.assertIn("non-fast-forward", result.stderr)
        self.assertEqual(self.remote_sha("main"), other)
        self.assertEqual(self.remote_sha(RELEASE), self.base)


if __name__ == "__main__":
    unittest.main()
