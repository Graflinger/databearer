"""Offline tests for the weekly release promotion helper.

Run: python3 -B -m unittest discover -s scripts/tests -p 'test_release_promotion.py' -v

Git behavior uses temporary local repositories with a bare origin; HTTP uses fakes
and a deterministic clock. No network access or real remote is involved.
"""

from datetime import date
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[1] / "release_promotion.py"
SPEC = importlib.util.spec_from_file_location("release_promotion", SCRIPT)
promotion = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(promotion)

BASE = "https://blog.databearer.de"
ENV = dict(os.environ, GIT_AUTHOR_NAME="Test", GIT_AUTHOR_EMAIL="test@example.invalid",
           GIT_COMMITTER_NAME="Test", GIT_COMMITTER_EMAIL="test@example.invalid",
           GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1")


def run(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, env=ENV, check=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout.decode().strip()


def feed(*items):
    return json.dumps({"version": "https://jsonfeed.org/version/1.1", "items": [
        {"url": BASE + path, "title": title, "date_published": published}
        for path, title, published in items]}).encode()


class FakeClock:
    def __init__(self):
        self.now = 0

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


class GitTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        self.origin = root / "origin.git"
        self.repo = root / "release"
        self.other = root / "other"
        run(root, "init", "--bare", "-b", "main", str(self.origin))
        run(root, "clone", "-q", str(self.origin), str(self.other))
        self.write(self.other, "frontend/post.md", "one")
        run(self.other, "add", "-A")
        run(self.other, "commit", "-qm", "release")
        self.release = run(self.other, "rev-parse", "HEAD")
        run(self.other, "push", "-q", "origin", "HEAD:refs/heads/main", "HEAD:refs/heads/releases/cloudflare")
        self.candidate = self.commit_main("frontend/post2.md", "two")
        run(root, "clone", "-q", "-b", "releases/cloudflare", str(self.origin), str(self.repo))

    @staticmethod
    def write(repo, name, content):
        path = Path(repo) / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def commit_main(self, name, content):
        self.write(self.other, name, content)
        run(self.other, "add", "-A")
        run(self.other, "commit", "-qm", f"change {name}")
        run(self.other, "push", "-q", "origin", "HEAD:refs/heads/main")
        return run(self.other, "rev-parse", "HEAD")

    def remote(self, branch):
        return run(self.origin, "rev-parse", f"refs/heads/{branch}")

    def fetched(self):
        run(self.repo, "fetch", "-q", "origin")

    def test_check_accepts_descendant_and_counts_commits(self):
        self.fetched()
        promotion.check(self.release, self.candidate, repo=self.repo)

    def test_check_rejects_workflow_changes(self):
        candidate = self.commit_main(".github/workflows/new.yml", "on: push")
        self.fetched()
        with self.assertRaisesRegex(promotion.PromotionError, "workflow files.*new.yml"):
            promotion.check(self.release, candidate, repo=self.repo)

    def test_check_rejects_candidate_without_release_and_wrong_checkout(self):
        self.fetched()
        with self.assertRaisesRegex(promotion.PromotionError, "does not contain the current release"):
            promotion.check_candidate(self.repo, self.candidate, self.release)
        with self.assertRaisesRegex(promotion.PromotionError, "differs from release SHA"):
            promotion.check(self.candidate, self.candidate, repo=self.repo)
        run(self.repo, "checkout", "-q", "-b", "elsewhere")
        with self.assertRaisesRegex(promotion.PromotionError, "release branch checkout"):
            promotion.check(self.release, self.candidate, repo=self.repo)

    def test_push_fast_forwards_release_to_validated_main(self):
        promotion.push(self.release, self.candidate, repo=self.repo)
        self.assertEqual(self.remote("releases/cloudflare"), self.candidate)
        self.assertEqual(self.remote("main"), self.candidate)

    def test_push_refuses_when_main_moved_after_validation(self):
        self.commit_main("frontend/post3.md", "three")
        with self.assertRaisesRegex(promotion.PromotionError, "origin/main differs"):
            promotion.push(self.release, self.candidate, repo=self.repo)
        self.assertEqual(self.remote("releases/cloudflare"), self.release)

    def test_push_refuses_when_release_moved(self):
        run(self.other, "checkout", "-q", "-b", "data", self.release)
        self.write(self.other, "frontend/data.json", "{}")
        run(self.other, "add", "-A")
        run(self.other, "commit", "-qm", "data refresh")
        run(self.other, "push", "-q", "origin", "HEAD:refs/heads/releases/cloudflare")
        moved = self.remote("releases/cloudflare")
        with self.assertRaisesRegex(promotion.PromotionError, "moved since validation"):
            promotion.push(self.release, self.candidate, repo=self.repo)
        self.assertEqual(self.remote("releases/cloudflare"), moved)


class PlanTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.public = feed(("/posts/2026/old/", "Old", "2026-09-27T00:00:00.000Z"))
        self.sha = "a" * 40
        self.today = date(2026, 10, 4)
        self.counter = 0

    def run_plan(self, candidate_feed, **kwargs):
        self.counter += 1
        path = self.root / f"feed{self.counter}.json"
        path.write_bytes(candidate_feed)
        out = self.root / f"plan{self.counter}.json"
        result = promotion.plan(self.sha, path, out, today=self.today,
                                fetch=lambda url, timeout: self.public, **kwargs)
        return result, out

    def test_new_post_on_publication_day_is_planned(self):
        summary = self.root / "summary.md"
        result, out = self.run_plan(feed(("/posts/2026/new/", "New", "2026-10-04T00:00:00.000Z"),
                                         ("/posts/2026/old/", "Old", "2026-09-27T00:00:00.000Z")),
                                    summary=summary)
        self.assertEqual(result["new_posts"], [{"path": "/posts/2026/new/", "title": "New", "date": "2026-10-04"}])
        self.assertEqual(json.loads(out.read_text())["candidate"], self.sha)
        self.assertIn("/posts/2026/new/", summary.read_text())

    def test_future_date_fails_and_writes_no_plan(self):
        with self.assertRaisesRegex(promotion.PromotionError, "future date 2026-10-05"):
            self.run_plan(feed(("/posts/2026/new/", "New", "2026-10-05T00:00:00.000Z"),
                               ("/posts/2026/old/", "Old", "2026-09-27T00:00:00.000Z")))
        self.assertFalse((self.root / "plan1.json").exists())

    def test_berlin_day_decides_future_dates(self):
        # 23:30 UTC on Saturday is already Sunday in Berlin.
        result, _ = self.run_plan(feed(("/posts/2026/new/", "New", "2026-10-03T23:30:00.000Z"),
                                       ("/posts/2026/old/", "Old", "2026-09-27T00:00:00.000Z")))
        self.assertEqual(result["new_posts"][0]["date"], "2026-10-04")

    def test_stale_date_and_removed_post_only_warn(self):
        with mock.patch("builtins.print") as printed:
            result, _ = self.run_plan(feed(("/posts/2026/late/", "Late", "2026-09-20T00:00:00.000Z")))
        output = "\n".join(str(call.args[0]) for call in printed.call_args_list)
        self.assertIn("::warning::/posts/2026/late/ is first published today but dated 2026-09-20", output)
        self.assertIn("::warning::/posts/2026/old/ is public but missing", output)
        self.assertEqual(result["removed"], ["/posts/2026/old/"])

    def test_unchanged_feed_plans_no_posts(self):
        result, _ = self.run_plan(self.public)
        self.assertEqual(result["new_posts"], [])

    def test_invalid_feeds_and_paths_are_rejected(self):
        with self.assertRaisesRegex(promotion.PromotionError, "lacks url"):
            self.run_plan(json.dumps({"items": [{"url": BASE + "/x/"}]}).encode())
        with self.assertRaisesRegex(promotion.PromotionError, "new absolute path"):
            promotion.plan(self.sha, self.root / "f.json", "relative.json", fetch=None)


class VerifyTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.plan = Path(temp.name) / "plan.json"
        self.state = {"schema_version": 1, "candidate": "b" * 40, "base_url": BASE, "removed": [],
                      "new_posts": [{"path": "/posts/2026/new/", "title": "New", "date": "2026-10-04"}]}
        self.plan.write_text(json.dumps(self.state))
        self.clock = FakeClock()
        self.requests = []

    def verify(self, responses, timeout=60):
        def fetch(url, timeout):
            self.requests.append(url)
            path = url.split("?", 1)[0].removeprefix(BASE)
            value = responses(path)
            if isinstance(value, Exception):
                raise value
            return value
        return promotion.verify(self.plan, timeout=timeout, interval=10, fetch=fetch,
                                clock=self.clock, sleep=self.clock.sleep, report=lambda _: None)

    def test_waits_until_feed_and_page_are_live(self):
        live = feed(("/posts/2026/new/", "New", "2026-10-04T00:00:00.000Z"))
        responses = lambda path: (feed() if self.clock.now < 20 else live) if path == "/feed.json" else b"<html>"
        self.assertTrue(self.verify(responses))
        self.assertEqual(self.clock.now, 20)
        self.assertTrue(all("verify=" + "b" * 12 in url for url in self.requests))

    def test_times_out_when_page_never_appears(self):
        live = feed(("/posts/2026/new/", "New", "2026-10-04T00:00:00.000Z"))
        missing = promotion.PromotionError("HTTP 404")
        self.assertFalse(self.verify(lambda path: live if path == "/feed.json" else missing, timeout=30))

    def test_no_new_posts_checks_home_page_only(self):
        self.state["new_posts"] = []
        self.plan.write_text(json.dumps(self.state))
        self.assertTrue(self.verify(lambda path: b"<html>"))
        self.assertEqual([url.split("?")[0] for url in self.requests], [BASE + "/"])


class CliTests(unittest.TestCase):
    def test_errors_return_one_without_traceback(self):
        with mock.patch("sys.stderr"):
            self.assertEqual(promotion.main(["check", "--release", "x", "--candidate", "y"]), 1)
            self.assertEqual(promotion.main(["unknown"]), 1)



if __name__ == "__main__":
    unittest.main()
