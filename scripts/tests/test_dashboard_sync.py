"""Offline integration tests with real Git and temporary, file-only bare origins.

Run: python3 -B -m unittest discover -s scripts/tests -p 'test_dashboard_sync.py' -v
"""

import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "dashboard_sync.py"
RELEASE = "releases/cloudflare"


class DashboardSyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="dashboard sync tests ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.repo = self.root / "released checkout"
        self.repo.mkdir()
        self.origin = self.root / "origin.git"
        self.worktree = self.root / "validation worktree"
        self.state_path = self.root / "sync state.json"
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
        (self.repo / ".gitignore").write_text("ignored/\n", encoding="utf-8")
        self.git("add", ".gitignore")
        self.initial = self.commit("data.json", '{"day":1}\n')
        self.git("branch", RELEASE)
        self.base = self.commit("unpublished.py", "main work\n")
        self.git("push", "origin", "HEAD:refs/heads/main")
        self.git("switch", RELEASE)
        self.release = self.commit("data.json", '{"day":2}\n')
        self.git("push", "origin", f"HEAD:refs/heads/{RELEASE}")

    def process(self, command, cwd=None):
        return subprocess.run(command, cwd=cwd or self.repo, env=self.env, text=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)

    def git(self, *args, cwd=None):
        result = self.process(["git", *args], cwd)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout.strip()

    def commit(self, path, content, cwd=None):
        cwd = cwd or self.repo
        (cwd / path).write_text(content, encoding="utf-8")
        self.git("add", "--", path, cwd=cwd)
        self.git("commit", "-m", "fixture: " + path, cwd=cwd)
        return self.git("rev-parse", "HEAD", cwd=cwd)

    def cli(self, *args, success=True):
        result = self.process([sys.executable, "-B", str(SCRIPT), *args])
        self.assertEqual(result.returncode, 0 if success else 1, result.stdout + result.stderr)
        if success:
            self.assertEqual(result.stderr, "")
        else:
            self.assertEqual(result.stdout, "")
            self.assertIn("production is unaffected", result.stderr)
        return result

    def prepare(self, success=True, release=None):
        return self.cli("prepare", "--release", release or self.release,
                        "--worktree", str(self.worktree), "--state", str(self.state_path),
                        success=success)

    def publish(self, success=True):
        return self.cli("publish", "--state", str(self.state_path), success=success)

    def state(self):
        return json.loads(self.state_path.read_text(encoding="utf-8"))

    def refs(self):
        return tuple(self.git("rev-parse", f"refs/heads/{branch}", cwd=self.origin)
                     for branch in ("main", RELEASE))

    def hook(self, name, body, bare=False):
        path = (self.origin if bare else self.repo / ".git") / "hooks" / name
        path.write_text("#!/bin/sh\nset -eu\n" + body + "\n", encoding="utf-8")
        path.chmod(0o755)

    def competing_commit(self, parent):
        tree = self.git("rev-parse", f"{parent}^{{tree}}", cwd=self.origin)
        return self.git("commit-tree", tree, "-p", parent, "-m", "concurrent writer", cwd=self.origin)

    def assert_output(self, result, changed, candidate):
        self.assertEqual(result.stdout, f"changed={str(changed).lower()}\ncandidate={candidate}\n")

    def test_divergent_main_and_release_preserve_work_and_real_ancestry(self):
        config = (self.repo / ".git/config").read_bytes()
        result = self.prepare()
        state = self.state()
        candidate = state["candidate"]
        self.assertEqual(state["main_base"], self.base)
        self.assertEqual(state["release"], self.release)
        self.assertEqual(state["worktree"], str(self.worktree))
        self.assert_output(result, True, candidate)
        self.assertEqual(self.refs(), (self.base, self.release))
        self.assertEqual(self.git("show", "-s", "--format=%P", candidate), f"{self.base} {self.release}")
        for parent in (self.base, self.release):
            self.git("merge-base", "--is-ancestor", parent, candidate)
        self.assertEqual((self.worktree / "unpublished.py").read_text(), "main work\n")
        self.assertEqual((self.worktree / "data.json").read_text(), '{"day":2}\n')
        self.assertFalse((self.repo / "unpublished.py").exists())
        self.assertEqual(self.git("rev-parse", "HEAD"), self.release)
        identity = self.git("show", "-s", "--format=%an%n%ae%n%cn%n%ce", candidate).splitlines()
        self.assertEqual(identity, ["github-actions[bot]",
                                   "41898282+github-actions[bot]@users.noreply.github.com"] * 2)
        self.assert_output(self.publish(), True, candidate)
        self.assertEqual(self.refs(), (candidate, self.release))
        self.assertEqual((self.repo / ".git/config").read_bytes(), config)

    def test_prepare_fetches_main_instead_of_using_stale_tracking_ref(self):
        other = self.competing_commit(self.base)
        self.git("update-ref", "refs/heads/main", other, self.base, cwd=self.origin)
        self.prepare()
        self.assertEqual(self.state()["main_base"], other)
        self.assertEqual(self.git("show", "-s", "--format=%P", self.state()["candidate"]),
                         f"{other} {self.release}")

    def test_fast_forward_is_exact_release(self):
        self.git("update-ref", "refs/heads/main", self.initial, self.base, cwd=self.origin)
        self.git("update-ref", "refs/remotes/origin/main", self.initial)
        result = self.prepare()
        self.assert_output(result, True, self.release)
        self.assertEqual(self.state()["candidate"], self.release)
        self.publish()
        self.assertEqual(self.refs(), (self.release, self.release))

    def test_shallow_release_checkout_fetches_complete_ancestry(self):
        checkout = self.root / "shallow release checkout"
        self.git("clone", "--depth=1", "--single-branch", "--branch", RELEASE,
                 self.origin.as_uri(), str(checkout))
        self.repo = checkout
        self.assertEqual(self.git("rev-parse", "--is-shallow-repository"), "true")
        self.prepare()
        self.assertEqual(self.git("rev-parse", "--is-shallow-repository"), "false")
        candidate = self.state()["candidate"]
        self.assertEqual(self.git("show", "-s", "--format=%P", candidate), f"{self.base} {self.release}")
        self.publish()
        self.assertEqual(self.refs(), (candidate, self.release))

    def test_equal_main_and_release_is_noop(self):
        self.git("update-ref", "refs/heads/main", self.release, self.base, cwd=self.origin)
        self.git("update-ref", "refs/remotes/origin/main", self.release)
        self.hook("pre-push", "exit 1")
        self.assert_output(self.prepare(), False, self.release)
        self.assert_output(self.publish(), False, self.release)
        self.assertEqual(self.refs(), (self.release, self.release))

    def test_already_integrated_noop_creates_state_and_never_pushes(self):
        self.git("switch", "main")
        self.git("merge", "--no-edit", self.release)
        self.base = self.commit("later.py", "later main work\n")
        self.git("push", "origin", "HEAD:refs/heads/main")
        self.git("switch", RELEASE)
        self.hook("pre-push", "exit 1")
        self.assert_output(self.prepare(), False, self.base)
        self.assertTrue(self.worktree.is_dir())
        self.assert_output(self.publish(), False, self.base)
        self.assertEqual(self.refs(), (self.base, self.release))

    def test_conflict_leaves_remote_refs_and_released_checkout_intact(self):
        self.git("switch", "main")
        self.base = self.commit("data.json", '{"main":"conflicting"}\n')
        self.git("push", "origin", "HEAD:refs/heads/main")
        self.git("switch", RELEASE)
        self.assertIn("git merge failed", self.prepare(success=False).stderr)
        self.assertFalse(self.state_path.exists())
        self.assertEqual(self.refs(), (self.base, self.release))
        self.assertEqual(self.git("rev-parse", "HEAD"), self.release)
        self.assertEqual(self.git("rev-parse", "MERGE_HEAD", cwd=self.worktree), self.release)
        self.publish(success=False)

    def test_exact_release_required_before_worktree_creation(self):
        other = self.competing_commit(self.release)
        self.git("update-ref", f"refs/heads/{RELEASE}", other, self.release, cwd=self.origin)
        self.assertIn("differs from expected release", self.prepare(success=False).stderr)
        self.assertFalse(self.worktree.exists())
        self.assertFalse(self.state_path.exists())
        self.assertEqual(self.refs(), (self.base, other))

    def test_sha_must_be_full_and_not_a_ref_expression(self):
        for release in ("HEAD", self.release[:12], self.release + "^", "--all"):
            with self.subTest(release=release):
                self.prepare(success=False, release=release)
        self.assertEqual(self.refs(), (self.base, self.release))

    def test_validation_tracked_staged_untracked_and_mode_mutations_block(self):
        self.prepare()
        for mutation in ("tracked", "staged", "untracked", "executable"):
            with self.subTest(mutation=mutation):
                target = self.worktree / ("unexpected.txt" if mutation == "untracked" else "data.json")
                if mutation == "executable":
                    # Even checkouts with core.filemode=false must catch this.
                    self.env.update(GIT_CONFIG_COUNT="1", GIT_CONFIG_KEY_0="core.filemode",
                                    GIT_CONFIG_VALUE_0="false")
                    target.chmod(0o755)
                else:
                    target.write_text("validation mutation\n", encoding="utf-8")
                if mutation == "staged":
                    self.git("add", "data.json", cwd=self.worktree)
                self.assertIn("must be clean", self.publish(success=False).stderr)
                self.assertEqual(self.refs(), (self.base, self.release))
                if mutation == "untracked":
                    target.unlink()
                else:
                    target.chmod(0o644)
                    self.git("restore", "--source=HEAD", "--staged", "--worktree", "data.json",
                             cwd=self.worktree)

    def test_ignored_validation_outputs_are_allowed(self):
        self.prepare()
        ignored = self.worktree / "ignored"
        ignored.mkdir()
        (ignored / "build-output").write_text("generated", encoding="utf-8")
        self.publish()
        self.assertEqual(self.refs(), (self.state()["candidate"], self.release))

    def test_validation_commit_blocks_even_when_clean(self):
        self.prepare()
        self.commit("unexpected.txt", "extra commit", cwd=self.worktree)
        self.assertIn("HEAD differs", self.publish(success=False).stderr)
        self.assertEqual(self.refs(), (self.base, self.release))

    def test_detached_validation_worktree_blocks(self):
        self.prepare()
        self.git("checkout", "--detach", cwd=self.worktree)
        self.publish(success=False)
        self.assertEqual(self.refs(), (self.base, self.release))

    def test_editing_state_to_accept_extra_commit_still_blocks(self):
        self.prepare()
        extra = self.commit("unexpected.txt", "extra commit", cwd=self.worktree)
        state = self.state()
        state["candidate"] = extra
        self.state_path.write_text(json.dumps(state), encoding="utf-8")
        self.assertIn("extra candidate commits", self.publish(success=False).stderr)
        self.assertEqual(self.refs(), (self.base, self.release))

    def test_candidate_without_release_ancestry_blocks(self):
        self.prepare()
        self.git("reset", "--hard", self.base, cwd=self.worktree)
        state = self.state()
        state["candidate"] = self.base
        self.state_path.write_text(json.dumps(state), encoding="utf-8")
        self.assertIn("both original main and exact release", self.publish(success=False).stderr)
        self.assertEqual(self.refs(), (self.base, self.release))

    def test_main_advance_before_publish_blocks(self):
        self.prepare()
        other = self.competing_commit(self.base)
        self.git("update-ref", "refs/heads/main", other, self.base, cwd=self.origin)
        self.assertIn("origin/main moved", self.publish(success=False).stderr)
        self.assertEqual(self.refs(), (other, self.release))

    def test_release_advance_before_publish_blocks(self):
        self.prepare()
        other = self.competing_commit(self.release)
        self.git("update-ref", f"refs/heads/{RELEASE}", other, self.release, cwd=self.origin)
        self.assertIn("origin/releases/cloudflare moved", self.publish(success=False).stderr)
        self.assertEqual(self.refs(), (self.base, other))

    def test_main_advance_after_refetch_is_rejected_without_retry(self):
        self.prepare()
        other = self.competing_commit(self.base)
        self.hook("pre-push", f"git --git-dir={shlex.quote(str(self.origin))} "
                  f"update-ref refs/heads/main {other} {self.base}")
        self.publish(success=False)
        self.assertEqual(self.refs(), (other, self.release))

    def test_rejected_push_preserves_release_and_does_not_skip_hooks(self):
        self.prepare()
        self.hook("pre-receive", "exit 1", bare=True)
        self.publish(success=False)
        self.assertEqual(self.refs(), (self.base, self.release))

    def test_release_advance_during_push_is_reported_without_reverting_either_ref(self):
        self.prepare()
        other = self.competing_commit(self.release)
        self.hook("pre-push", f"git --git-dir={shlex.quote(str(self.origin))} "
                  f"update-ref refs/heads/{RELEASE} {other} {self.release}")
        self.assertIn("main may already contain", self.publish(success=False).stderr)
        self.assertEqual(self.refs(), (self.state()["candidate"], other))

    def test_pre_push_hook_rejection_is_not_bypassed(self):
        self.prepare()
        self.hook("pre-push", "exit 1")
        self.assertIn("git push failed", self.publish(success=False).stderr)
        self.assertEqual(self.refs(), (self.base, self.release))

    def test_push_has_only_nonforce_main_destination_and_no_implicit_tags(self):
        self.prepare()
        candidate = self.state()["candidate"]
        self.git("tag", "-a", "fixture-tag", "-m", "fixture", candidate)
        self.env.update(GIT_CONFIG_COUNT="2", GIT_CONFIG_KEY_0="push.followTags",
                        GIT_CONFIG_VALUE_0="true", GIT_CONFIG_KEY_1="remote.origin.mirror",
                        GIT_CONFIG_VALUE_1="true")
        log = self.root / "push refs"
        self.hook("pre-push", f"cat > {shlex.quote(str(log))}")
        self.hook("pre-receive", 'while read old new ref; do\n'
                  '  test "$ref" = refs/heads/main\n'
                  '  git merge-base --is-ancestor "$old" "$new"\ndone', bare=True)
        self.publish()
        self.assertEqual(log.read_text().splitlines(),
                         [f"{candidate} {candidate} refs/heads/main {self.base}"])
        self.assertEqual(self.git("tag", cwd=self.origin), "")
        self.assertEqual(self.refs(), (candidate, self.release))

    def test_wrong_checkout_branch_and_relative_paths_fail(self):
        self.git("switch", "main")
        self.assertIn("release branch checkout", self.prepare(success=False).stderr)
        self.git("switch", RELEASE)
        self.cli("prepare", "--release", self.release, "--worktree", "relative",
                 "--state", str(self.state_path), success=False)
        self.cli("prepare", "--release", self.release, "--worktree", str(self.worktree),
                 "--state", str(self.worktree / "state.json"), success=False)
        self.assertEqual(self.refs(), (self.base, self.release))

    def test_existing_state_is_not_overwritten(self):
        self.state_path.write_text("existing state", encoding="utf-8")
        self.assertIn("State already exists", self.prepare(success=False).stderr)
        self.assertEqual(self.state_path.read_text(), "existing state")
        self.assertFalse(self.worktree.exists())


if __name__ == "__main__":
    unittest.main()
