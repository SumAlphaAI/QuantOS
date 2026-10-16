# TP12 Read-Only Reference

This directory holds the evaluation baseline for `nautechsystems/nautilus_agents`.

## Purpose

- lock the upstream repository, commit, license, and descriptor digests;
- store the interface diff, no-coupling rules, and threat-model inputs for TP12;
- verify that the upstream agent-kernel collaboration model does not change the QuantOS "Agent never connects to a venue" boundary;
- record a reproducible reference without any runtime dependency.

## Files

- `baseline.lock.json`: fixed reference metadata, source hashes and explicit unknowns.
- `interface-diff.md`: surface-by-surface diff between the nautilus_agents protocol and QuantOS contracts.
- `no-coupling-rules.json`: machine-readable no-coupling rules (7 rules), each with control pointers and behavioral test mapping.

## Rebuild procedure

```bash
git init nautilus-agents-readonly
git -C nautilus-agents-readonly remote add upstream https://github.com/nautechsystems/nautilus_agents.git
git -C nautilus-agents-readonly fetch upstream 8d79877380f8617b45dff2b8c8b3790c2f9d963a
git -C nautilus-agents-readonly checkout --detach 8d79877380f8617b45dff2b8c8b3790c2f9d963a
```

## Hard boundary

`third_party/nautilus-agents/` is not a production source tree. The `nautilus-agents` crate must never enter a QuantOS lockfile. Its value is design evidence: it documents a compatible design principle; deployed authority/isolation requires separate evidence (agents propose, the engine/kernel decides, no venue authority for agent processes).

## Offline reassessment

`python3 scripts/tp12-evaluation.py` validates all 12 reference source files against the pinned Git commit/tree/blob chain and SHA-256, seven rules, six interfaces and eight threat hypotheses. `source-git-objects.json` supports offline integrity replay; it does not authenticate upstream signatures. Source files under `source-evidence` are retained LGPL reference evidence and excluded from build/runtime graphs. No upstream execution, installation, code absorption or runtime dependency is authorized. TP12 CVE audit remains NOT_RUN. TP07 advisory hits/unknowns remain open.
