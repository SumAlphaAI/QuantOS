# TP08 Read-Only Reference

This directory holds the evaluation baseline for `microsoft/qlib`.

## Purpose

- lock the upstream repository, commit, license, and dependency digests;
- store the capability matrix, SBOM, and CVE evidence for TP08;
- keep `DataSnapshot` / `ResearchArtifact` mapping samples that prove Qlib concepts can be represented inside QuantOS contracts;
- record a reproducible reference without turning Qlib into a QuantOS runtime dependency or a second Quant Core.

## Files

- `baseline.lock.json`: authoritative baseline metadata for TP08 monitoring.
- `capability-matrix.md`: capability evaluation against QuantOS requirements.
- `sbom.spdx.json`: SPDX document for the pinned upstream baseline.
- `cve-audit.md`: CVE scan record and current scan limitations.
- `mappings/`: three offline experiment mapping samples into QuantOS contracts.

## Rebuild procedure

Use an isolated workspace outside the QuantOS runtime tree:

```bash
git init qlib-readonly
git -C qlib-readonly remote add upstream https://github.com/microsoft/qlib.git
git -C qlib-readonly fetch upstream d5379c520f66a39953bad76234a7019a72796fd0
git -C qlib-readonly checkout --detach d5379c520f66a39953bad76234a7019a72796fd0
```

Validate the digests against `baseline.lock.json` before using the snapshot for any review or mapping extraction.

## Hard boundary

`third_party/qlib/` is not a production source tree. QuantOS production artifacts must come only from QuantOS-owned engines (`engines/llmquant`, `engines/rd-agent`). Qlib remains reference-only per the TP08 ADR.
