# TP08 Qlib reference evaluation

Decision: `reference_only`; no Qlib adapter, installation or second Quant Core.
Pinned source: `microsoft/qlib@d5379c520f66a39953bad76234a7019a72796fd0` (MIT).
Six downloaded source files are retained with upstream URLs and full byte digests in `upstream-evidence/provenance.json`. They were read, not executed. MIT notices are retained. Software license does not grant market dataset rights.

## Reproduce locally

```bash
engines/.venv/bin/python third_party/qlib/experiments.py --output artifacts/tp08-development
node scripts/tp08-evaluation.mjs artifacts/tp08-development
engines/.venv/bin/python -m pytest engines/tests/test_tp08_qlib_mapping_samples.py -vv
node --test scripts/tp08-evaluation.test.mjs
node third_party/qlib/check-development.mjs --record
```

The code is QuantOS-owned and reads only a closed synthetic fixture. Experiment 1 computes mean5/return1 (24 feature rows), mapping actual bytes into typed `DataSnapshot`. Experiment 2 evaluates a zero-return baseline (21 samples, MAE 0.02485689), mapping configuration and metrics into typed `ResearchArtifact`. Experiment 3 repeats the same inputs and checks identical bytes and three scoped mock objects. Historical mapping filenames refer to the inspiration, not executed Alpha158/LightGBM/Runtime implementations.

The checked-in `mappings/` files are current reproducible examples. Their research envelope binds the exact `engines/uv.lock` bytes, so a reviewed lock update requires regenerating these examples and `receipt.json` with the CLI above. The 2026-10-25 filelock update, like the earlier certifi update, changes only the research environment hash, its envelope hash and the corresponding receipt digest; synthetic inputs, all three object bytes and reference-only restrictions stay identical. Historical audit evidence remains bound to its original source and environment.

The 2026-10-28 msgpack security update follows the same rule. Regenerate into a temporary artifact directory, review the byte differences, and copy the changed current examples and receipt into `mappings/`. The TP08 Python replay and Node verifier must both pass before committing a workspace lock update. This refresh is current offline sample maintenance; historical TP08 receipts and formal admission remain unchanged.

No Qlib, full Alpha158, trained model, MLflow, database, persistent storage or deployed Runtime executes. Tenant/workspace/actor scope is enforced by the reference in-memory store; this is not deployed authentication. Mock URIs are backed by checked-in bytes, not uploaded objects. Synthetic metrics are diagnostics, not investment results.

## Supply chain and Gate

`baseline.lock.json`, `sbom.spdx.json`, `direct-dependencies.json` and `cve-audit.json` distinguish a descriptor-only inventory from a resolved graph. Twenty-three declared requirements are recorded but not installed. Current advisory scan: NOT RUN; resolved graph: NOT_ASSESSED. Historical failed audit is preserved separately. Git SHA-1 is a commit identifier, never a SHA-256 archive checksum.

Production build/manifest guards reject Qlib paths and runtime lock entries. This only establishes TP08 exclusion; it does not grant a production release. Unified functional admission refreshes F05/F0 separately; engineering checks alone return NOT_ASSESSED. Formal acceptance remains false.
