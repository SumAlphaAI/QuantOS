# TP01 Read-Only Reference

This directory holds the V0 governance baseline for `HKUDS/Vibe-Trading`.

## Purpose

- lock the upstream repository, tag, commit, license, and dependency digests;
- store initial SBOM / CVE evidence for TP01-A;
- keep a reproducible reference record without turning upstream code into a QuantOS runtime dependency.

## Files

- `baseline.lock.json`: authoritative baseline metadata for TP01 monitoring.
- `sbom.spdx.json`: initial SPDX document for the locked upstream baseline.
- `cve-audit.md`: initial CVE scan record and current scan limitations.
- `upstream-src/`: read-only Git submodule pinned to the baseline commit. Its
  checkout may be sparse, but Git can retrieve any source blob from the fixed
  object without following upstream `main`.

## Rebuild procedure

Initialize the repository-pinned read-only copy:

```bash
git submodule update --init --depth 1 third_party/vibe-trading/upstream-src
node ./scripts/bootstrap-vibe-repositories.mjs
```

Validate the digests against `baseline.lock.json` before using the snapshot for any review or fixture extraction.

## Hard boundary

`third_party/vibe-trading/` is not a production source tree. QuantOS production artifacts must come only from `engines/vibe-adapter` after TP01 V1 contract and security gates pass.
