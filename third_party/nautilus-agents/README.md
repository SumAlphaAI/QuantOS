# TP12 Read-Only Reference

This directory holds the evaluation baseline for `nautechsystems/nautilus_agents`.

## Purpose

- lock the upstream repository, commit, license, and descriptor digests;
- store the interface diff, no-coupling rules, and threat-model inputs for TP12;
- verify that the upstream agent-kernel collaboration model does not change the QuantOS "Agent never connects to a venue" boundary;
- record a reproducible reference without any runtime dependency.

## Files

- `baseline.lock.json`: authoritative baseline metadata for TP12 monitoring.
- `interface-diff.md`: surface-by-surface diff between the nautilus_agents protocol and QuantOS contracts.
- `no-coupling-rules.json`: machine-readable no-coupling rules (7 rules), each with enforcement points and code evidence.

## Rebuild procedure

```bash
git init nautilus-agents-readonly
git -C nautilus-agents-readonly remote add upstream https://github.com/nautechsystems/nautilus_agents.git
git -C nautilus-agents-readonly fetch upstream 8d79877380f8617b45dff2b8c8b3790c2f9d963a
git -C nautilus-agents-readonly checkout --detach 8d79877380f8617b45dff2b8c8b3790c2f9d963a
```

## Hard boundary

`third_party/nautilus-agents/` is not a production source tree. The `nautilus-agents` crate must never enter a QuantOS lockfile. Its value is design evidence: it confirms the authority boundary QuantOS already enforces (agents propose, the engine/kernel decides, no venue authority for agent processes).
