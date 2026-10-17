"""Mutation tests for the X3 boundary review, independent of target admission."""

import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location(
    "tp12_review", Path(__file__).parents[1] / "tp12-boundary-review.py"
)
E = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(E)


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="quantos-tp12-x3-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(E.ROOT / E.BASE, self.root / E.BASE)
        self.review = json.loads(
            (E.ROOT / E.BASE / "x3-boundary-review.json").read_text()
        )
        old = E.REFERENCE.load(E.ROOT, E.BASE / "boundary-assessment.json")
        rules = E.REFERENCE.load(E.ROOT, E.BASE / "no-coupling-rules.json")["rules"]
        files = [
            "Cargo.lock",
            "engines/uv.lock",
            "pnpm-lock.yaml",
            "third_party/nautilus-trader/baseline.lock.json",
        ]
        files += [
            p["path"] for r in rules for p in r["evidence"] + [r["behavioralEvidence"]]
        ]
        files += [
            i["owned"]["path"] for i in old["interfaces"] + self.review["interfaces"]
        ]
        files += [
            p["path"] for r in self.review["rules"] for p in r["controls"] + r["tests"]
        ]
        for name in set(files):
            p = self.root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(E.ROOT / name, p)
        subprocess.run(["git", "init", "-q", self.root], check=True)

    def mutate(self, change):
        change(self.review)
        (self.root / E.BASE / "x3-boundary-review.json").write_text(
            json.dumps(self.review)
        )

    def test_current_review_covers_all_surfaces_without_runtime_adoption(self):
        result = E.verify(self.root)
        self.assertEqual(
            (result["rules"], result["interfaces"], result["threats"]), (7, 6, 8)
        )
        self.assertEqual(result["postTp07IntegrationFullReview"], "NOT_RUN")
        self.assertFalse(result["formalAccepted"])

    def test_phase_pin_adoption_target_and_wire_promotions_are_rejected(self):
        mutations = [
            lambda d: d.update(upstreamCommit="a" * 40),
            lambda d: d.update(runtimeAdmission="ALLOWED"),
            lambda d: d.update(formalAccepted=True),
            lambda d: d["phases"].update(postTp07IntegrationFullReview="PASS"),
            lambda d: d["phases"].update(businessIntegration="PASS"),
            lambda d: d["rules"][0].update(targetStatus="PASS"),
            lambda d: d["rules"].pop(),
            lambda d: d["interfaces"][0].update(wireCompatible=True),
            lambda d: d["interfaces"][0].update(runtimeAdoption="ALLOWED"),
            lambda d: d["interfaces"].pop(),
            lambda d: d["threats"][0].update(rules=["NC-99"]),
            lambda d: d["threats"][0].update(targetStatus="PASS"),
            lambda d: d["threats"].pop(),
            lambda d: d.update(prerequisites=[]),
            lambda d: d["rules"][0]["controls"][0].update(symbol="missing_boundary"),
            lambda d: d["rules"][0]["tests"][0].update(path="../outside"),
        ]
        original = json.loads(json.dumps(self.review))
        for change in mutations:
            with self.subTest(change=mutations.index(change)):
                self.review = json.loads(json.dumps(original))
                self.mutate(change)
                with self.assertRaises((ValueError, AssertionError)):
                    E.verify(self.root)

    def test_renamed_runtime_dependencies_and_dynamic_loads_are_rejected(self):
        cases = [
            (
                "Cargo.toml",
                '[dependencies]\nrenamed = { package="nautilus-agents", version="0.2" }',
            ),
            (
                "engines/unsafe/pyproject.toml",
                '[project]\ndependencies=["nautilus_agents==0.2"]',
            ),
            (
                "apps/unsafe/package.json",
                '{"dependencies":{"safe":"npm:@nautechsystems/nautilus_agents"}}',
            ),
            ("engines/unsafe/load.py", "import os, nautilus_agents as safe\n"),
            ("engines/unsafe/load.py", "from nautilus_agents import AgentClient\n"),
            (
                "engines/unsafe/load.py",
                'import importlib\nimportlib.import_module("nautilus_agents")\n',
            ),
            ("engines/unsafe/load.py", '__import__("nautilus_trader")\n'),
            (
                "crates/unsafe/src/lib.rs",
                "fn main(){ nautilus_agents::AgentClient::new(); }",
            ),
            (
                "apps/unsafe/load.ts",
                'import { Agent } from "@nautechsystems/nautilus_agents";',
            ),
        ]
        cases += [
            ("apps/unsafe/load.ts", 'import "nautilus_agents";'),
            ("apps/unsafe/load.ts", 'const sdk = require("nautilus_agents");'),
            ("apps/unsafe/load.ts", 'const sdk = import("nautilus_agents");'),
        ]
        for name, content in cases:
            with self.subTest(path=name, content=content):
                path = self.root / name
                old = path.read_bytes() if path.exists() else None
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content)
                with self.assertRaises(ValueError):
                    E.exclude_runtime(self.root)
                if old is None:
                    path.unlink()
                else:
                    path.write_bytes(old)

    def test_runtime_symlink_escape_fails(self):
        path = self.root / "engines/escape.py"
        path.symlink_to(E.ROOT / "scripts/tp12-boundary-review.py")
        with self.assertRaisesRegex(ValueError, "symlink escape"):
            E.exclude_runtime(self.root)

    def test_cli_runtime_is_denied(self):
        result = subprocess.run(
            ["python3", str(E.ROOT / "scripts/tp12-boundary-review.py"), "--runtime"],
            capture_output=True,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn(b"runtime admission DENIED", result.stderr)


if __name__ == "__main__":
    unittest.main()
