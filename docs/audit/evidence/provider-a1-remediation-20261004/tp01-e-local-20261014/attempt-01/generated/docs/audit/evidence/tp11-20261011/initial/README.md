# TP11 Read-Only Reference

This directory holds the evaluation baseline for `Open-Dev-Society/OpenStock`.

## Purpose

- lock the upstream repository, commit, license, and dependency digests;
- store the provider comparison, Data Contract fixtures, SBOM, and CVE evidence for TP11;
- record a reproducible reference without turning OpenStock into a QuantOS runtime or Day-1 dependency.

## Files

- `baseline.lock.json`: authoritative baseline metadata for TP11 monitoring.
- `provider-comparison.md`: market-data provider comparison against TP05 Data Contract requirements.
- `sbom.spdx.json`: SPDX document for the pinned upstream baseline.
- `cve-audit.md`: CVE scan record with real `npm audit` results.
- `cve-audit-npm-audit.json`: raw audit output (evidence).
- `fixtures/`: two provider Data Contract fixtures with lineage/quality mapping and the unauthorized-data rejection case.

## Rebuild procedure

Use an isolated workspace outside the QuantOS runtime tree:

```bash
git init openstock-readonly
git -C openstock-readonly remote add upstream https://github.com/Open-Dev-Society/OpenStock.git
git -C openstock-readonly fetch upstream 4597c9a668118844b588f95eddb9342eed31c41d
git -C openstock-readonly checkout --detach 4597c9a668118844b588f95eddb9342eed31c41d
```

Validate the digests against `baseline.lock.json` before using the snapshot for any review or fixture extraction.

## Hard boundary

`third_party/openstock/` is not a production source tree. Upstream is AGPL-3.0-only: no code absorption, no Day-1 dependency, no lockfile entry anywhere in QuantOS. Market data enters QuantOS only through owned paths (TP05 `data.query.v1` providers with license gates, F05 snapshot catalog).
