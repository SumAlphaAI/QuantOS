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

## Rebuild procedure

Use an isolated workspace outside the QuantOS runtime tree:

```bash
git init vibe-trading-readonly
git -C vibe-trading-readonly remote add upstream https://github.com/HKUDS/Vibe-Trading.git
git -C vibe-trading-readonly fetch --tags upstream v0.1.12
git -C vibe-trading-readonly checkout --detach 43331c3221be37c5cc1ed8dddc4c7988bcddc5cd
```

Validate the digests against `baseline.lock.json` before using the snapshot for any review or fixture extraction.

## Hard boundary

`third_party/vibe-trading/` is not a production source tree. QuantOS production artifacts must come only from `engines/vibe-adapter` after TP01 V1 contract and security gates pass.
