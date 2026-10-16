import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location(
    "tp12_evaluation", Path(__file__).parents[1] / "tp12-evaluation.py"
)
E = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(E)


class EvaluationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="quantos-tp12-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(E.ROOT / E.BASE, self.root / E.BASE)
        for filename in [
            "Cargo.lock",
            "engines/uv.lock",
            "pnpm-lock.yaml",
            "third_party/nautilus-trader/baseline.lock.json",
        ]:
            self.copy(filename)
        rules = E.load(E.ROOT, E.BASE / "no-coupling-rules.json")["rules"]
        matrix = E.load(E.ROOT, E.BASE / "boundary-assessment.json")
        for pointer in [
            p for r in rules for p in r["evidence"] + [r["behavioralEvidence"]]
        ] + [x["owned"] for x in matrix["interfaces"]]:
            self.copy(pointer["path"])
        subprocess.run(["git", "init", "-q", self.root], check=True)

    def copy(self, name):
        p = self.root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(E.ROOT / name, p)

    def mutate(self, filename, change):
        p = self.root / E.BASE / filename
        d = json.loads(p.read_bytes())
        change(d)
        p.write_text(json.dumps(d))

    def test_complete_reference_assessment_denies_runtime(self):
        r = E.verify(self.root)
        self.assertEqual((r["rules"], r["threats"], r["interfaces"]), (7, 8, 6))
        self.assertEqual(r["runtimeAdmission"], "DENIED")

    def test_source_tamper_rejected(self):
        p = self.root / E.BASE / "source-evidence/README.md"
        p.write_bytes(p.read_bytes() + b"tamper")
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_rewritten_blob_metadata_cannot_forge_commit_tree(self):
        p = self.root / E.BASE / "source-evidence/README.md"
        data = p.read_bytes() + b"tamper"
        p.write_bytes(data)

        def change(d):
            f = next(f for f in d["sourceFiles"] if f["path"] == "README.md")
            f.update(
                sha256=E.sha(data),
                gitBlob=E.hashlib.sha1(
                    b"blob " + str(len(data)).encode() + b"\0" + data
                ).hexdigest(),
            )

        self.mutate("baseline.lock.json", change)
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_missing_or_duplicate_rules_rejected(self):
        self.mutate("no-coupling-rules.json", lambda d: d["rules"].pop())
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_escaping_evidence_rejected(self):
        self.mutate(
            "no-coupling-rules.json",
            lambda d: d["rules"][0]["evidence"][0].update(path="../outside"),
        )
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_missing_behavioral_anchor_rejected(self):
        self.mutate(
            "no-coupling-rules.json",
            lambda d: d["rules"][0]["behavioralEvidence"].update(
                symbol="missing_control"
            ),
        )
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_advisory_cannot_be_promoted_to_runtime_adoption(self):
        self.mutate(
            "boundary-assessment.json",
            lambda d: d["interfaces"][3].update(decision="ADOPTED"),
        )
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_missing_interface_rejected(self):
        self.mutate("boundary-assessment.json", lambda d: d["interfaces"].pop())
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_missing_threat_or_unknown_rule_rejected(self):
        self.mutate(
            "boundary-assessment.json",
            lambda d: d["threats"][0].update(rules=["NC-99"]),
        )
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_target_and_residual_risk_cannot_be_self_approved(self):
        self.mutate(
            "boundary-assessment.json",
            lambda d: d["threats"][0].update(targetStatus="PASS", residualRisk="LOW"),
        )
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_wrong_tp07_reference_rejected(self):
        self.mutate(
            "boundary-assessment.json", lambda d: d["basedOn"].update(commit="a" * 40)
        )
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_runtime_source_and_lock_injection_rejected(self):
        for filename, content in [
            ("Cargo.lock", 'name = "nautilus-agents"\n'),
            ("engines/unsafe/main.py", "import nautilus_agents\n"),
        ]:
            with self.subTest(filename=filename):
                p = self.root / filename
                original = p.read_bytes() if p.exists() else None
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(content)
                with self.assertRaises(AssertionError):
                    E.assert_production_excluded(self.root)
                if original is None:
                    p.unlink()
                else:
                    p.write_bytes(original)

    def test_license_and_cve_unknown_cannot_be_promoted(self):
        self.mutate(
            "baseline.lock.json", lambda d: d["cveAudit"].update(status="CLEAN")
        )
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_cli_denies_runtime(self):
        r = subprocess.run(
            ["python3", str(E.ROOT / "scripts/tp12-evaluation.py"), "--runtime"],
            capture_output=True,
        )
        self.assertNotEqual(r.returncode, 0)
        self.assertIn(b"cannot grant runtime", r.stderr)


if __name__ == "__main__":
    unittest.main()
