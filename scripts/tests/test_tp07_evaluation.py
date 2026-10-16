import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location(
    "tp07_evaluation", Path(__file__).parents[1] / "tp07-evaluation.py"
)
E = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(E)


class EvaluationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="quantos-tp07-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copytree(E.ROOT / E.BASE, self.root / E.BASE)
        for name in ["Cargo.lock", "engines/uv.lock", "pnpm-lock.yaml"]:
            p = self.root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(E.ROOT / name, p)
        subprocess.run(["git", "init", "-q", self.root], check=True)

    def mutate(self, name, change):
        path = self.root / E.BASE / name
        data = json.loads(path.read_bytes())
        change(data)
        path.write_bytes(E.encode(data))

    def test_complete_pinned_inventory_and_denied_runtime(self):
        r = E.verify(self.root)
        self.assertEqual(r["packages"], 1051)
        self.assertEqual(r["capabilities"], 7)
        self.assertEqual(r["runtimeAdmission"], "DENIED")

    def test_source_bytes_and_license_are_bound(self):
        p = self.root / E.BASE / "source-evidence/LICENSE"
        p.write_text(p.read_text() + "tamper")
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_rewritten_blob_metadata_cannot_forge_pinned_tree(self):
        p = self.root / E.BASE / "source-evidence/LICENSE"
        data = p.read_bytes() + b"tamper"
        p.write_bytes(data)

        def change(d):
            f = next(f for f in d["sourceFiles"] if f["path"] == "LICENSE")
            f["sha256"] = E.sha(data)
            f["gitBlob"] = E.hashlib.sha1(
                b"blob " + str(len(data)).encode() + b"\0" + data
            ).hexdigest()

        self.mutate("baseline.lock.json", change)
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_old_license_and_pin_rejected(self):
        baseline_path = self.root / E.BASE / "baseline.lock.json"
        original = baseline_path.read_bytes()
        for key, value in [
            ("license", "LGPL-3.0-only"),
            ("policy", {"runtimeAdmission": "READY"}),
        ]:
            with self.subTest(key=key):
                baseline_path.write_bytes(original)
                self.mutate("baseline.lock.json", lambda d: d.__setitem__(key, value))
                with self.assertRaises(AssertionError):
                    E.verify(self.root)

    def test_missing_or_duplicate_sbom_package_rejected(self):
        self.mutate("sbom.spdx.json", lambda d: d["packages"].pop())
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_query_inventory_cannot_drop_versions(self):
        self.mutate("osv-request.json", lambda d: d["queries"].pop())
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_cve_record_cannot_claim_clean_or_admit_runtime(self):
        self.mutate(
            "cve-audit.json", lambda d: d.__setitem__("vulnerabilityFree", True)
        )
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_missing_cve_response_or_wrong_lock_hash_rejected(self):
        self.mutate(
            "cve-audit.json",
            lambda d: d["lockHashes"].__setitem__("Cargo.lock", "0" * 64),
        )
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_capability_permission_replacement_and_forbidden_required(self):
        self.mutate(
            "capability-inventory.json",
            lambda d: d["capabilities"][0].__setitem__("permissions", ""),
        )
        with self.assertRaises(AssertionError):
            E.verify(self.root)

    def test_runtime_lock_and_source_imports_rejected(self):
        (self.root / "Cargo.lock").write_text('name = "nautilus-execution"\n')
        with self.assertRaises(AssertionError):
            E.assert_production_excluded(self.root)
        shutil.copyfile(E.ROOT / "Cargo.lock", self.root / "Cargo.lock")
        p = self.root / "services/forbidden/main.py"
        p.parent.mkdir(parents=True)
        p.write_text("from nautilus_trader import TradingNode\n")
        with self.assertRaises(AssertionError):
            E.assert_production_excluded(self.root)

    def test_runtime_cli_never_authorizes_execution(self):
        r = subprocess.run(
            ["python3", str(E.ROOT / "scripts/tp07-evaluation.py"), "--runtime"],
            capture_output=True,
        )
        self.assertNotEqual(r.returncode, 0)
        self.assertIn(b"cannot grant runtime", r.stderr)

    def test_unknown_advisory_results_remain_unknown(self):
        self.mutate(
            "cve-audit.json",
            lambda d: d.update(
                status="UNKNOWN_NETWORK",
                responseSha256=None,
                queriedPackages=0,
                error=[{"error": "offline"}],
            ),
        )
        self.assertEqual(E.verify(self.root)["cveStatus"], "UNKNOWN_NETWORK")
        self.mutate("cve-audit.json", lambda d: d.update(queriedPackages=1))
        with self.assertRaises(AssertionError):
            E.verify(self.root)


if __name__ == "__main__":
    unittest.main()
