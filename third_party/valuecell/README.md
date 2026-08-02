# TP10 Read-Only Reference

This directory holds the evaluation baseline for `ValueCell-ai/valuecell`.

## Purpose

- lock the upstream repository, commit, license, and descriptor digests;
- store the UX gap report, reusable interaction list, and no-coupling list for TP10;
- record a reproducible reference without copying source or taking any runtime dependency.

## Files

- `baseline.lock.json`: authoritative baseline metadata for TP10 monitoring.
- `ux-gap-report.md`: UX gap report + 12 UI patterns mapped to the QuantOS Terminal design spec + no-coupling list.

## Rebuild procedure

```bash
git init valuecell-readonly
git -C valuecell-readonly remote add upstream https://github.com/ValueCell-ai/valuecell.git
git -C valuecell-readonly fetch upstream 9793e9c0563fbf56fc096757d8bb80e209ac7aab
git -C valuecell-readonly checkout --detach 9793e9c0563fbf56fc096757d8bb80e209ac7aab
```

## Hard boundary

`third_party/valuecell/` is not a production source tree. ValueCell is evaluated for research UI/workflow information architecture only. Its data model, account system, agent runtime, and auto-trading surfaces must not be copied; no source code may be copied verbatim and no dependency may enter a QuantOS lockfile.
