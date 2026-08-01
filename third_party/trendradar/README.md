# TP09 Read-Only Reference

This directory holds the evaluation baseline for `sansan0/TrendRadar`.

## Purpose

- lock the upstream repository, commit, license, and dependency digests;
- store the data-license inventory, SBOM, and CVE evidence for TP09;
- keep trend signal schema samples that prove TrendRadar-style inputs can be represented inside the QuantOS `Signal` contract;
- record a reproducible reference without turning TrendRadar into a QuantOS runtime dependency.

## Files

- `baseline.lock.json`: authoritative baseline metadata for TP09 monitoring.
- `data-license-inventory.json`: machine-readable license/source inventory for TrendRadar input classes; every entry lacking a redistributable license is `trading_approved=false`.
- `sbom.spdx.json`: SPDX document for the pinned upstream baseline.
- `cve-audit.md`: CVE scan record and current scan limitations.
- `mappings/`: three offline input mapping samples into the QuantOS `Signal` contract.

## Rebuild procedure

Use an isolated workspace outside the QuantOS runtime tree:

```bash
git init trendradar-readonly
git -C trendradar-readonly remote add upstream https://github.com/sansan0/TrendRadar.git
git -C trendradar-readonly fetch upstream 8ee26026ba6c11dec41a95fb3895a7162876caa1
git -C trendradar-readonly checkout --detach 8ee26026ba6c11dec41a95fb3895a7162876caa1
```

Validate the digests against `baseline.lock.json` before using the snapshot for any review or mapping extraction.

## Hard boundary

`third_party/trendradar/` is not a production source tree. Upstream is GPL-3.0: no code absorption, no production dependency, no lockfile entry anywhere in QuantOS. Trend and news inputs enter QuantOS only through owned engines (TP03 `llmquant` fixtures, TP05 `data.query.v1` providers) with QuantOS-owned lineage and license labels.
