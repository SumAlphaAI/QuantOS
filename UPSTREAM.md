# Upstream Registry

This file is the authoritative upstream dependency ledger for third-party intake tasks.

## TP01: Vibe-Trading

### Locked upstream baseline

| Field | Value |
| --- | --- |
| Upstream repository | `https://github.com/HKUDS/Vibe-Trading.git` |
| Browse URL | `https://github.com/HKUDS/Vibe-Trading` |
| Locked tag | `v0.1.12` |
| Locked commit | `43331c3221be37c5cc1ed8dddc4c7988bcddc5cd` |
| Observed upstream `main` at capture | `261f007c410f7a6ff015a17f6830c8f809cd7413` |
| Baseline recorded at | `2026-07-30` |
| License conclusion | `MIT` |
| `LICENSE` SHA256 | `b155549b8bc4e43a9b96b2288dbf4eb1bc0c697f14b3f5ec6b36bf64d5a18679` |
| `NOTICE` SHA256 | `0f49802f7a666550b7c608e3514f9e97da48065aecb470f888d031a34a0cd07b` |
| `pyproject.toml` SHA256 | `bdaf67d33e22579d9ff3bfffcb44ce02bb4b7458a61b3ba12822af8966181ce4` |
| `requirements-lock.txt` SHA256 | `fd41f249f87bccb2f18ed8f1e4e35e19b83dbec96ca2b9987a1f4f912bf51849` |
| Read-only reference path | `third_party/vibe-trading/upstream-src` (pinned Git submodule) |
| Controlled fork URL | `https://github.com/SumAlphaAI/Vibe-Trading.git` |
| Controlled fork contract | `forks/vibe-trading/repository.lock.json` |
| Production artifact source | `engines/vibe-adapter` only |

### Intake constraints

1. `third_party/vibe-trading/` is reference material only. It must not become a build input, runtime dependency, or state source.
2. Production artifacts may only be emitted from `engines/vibe-adapter` after QuantOS contract, replay, negative-permission, and rollback tests pass.
3. QuantOS public contracts must not expose Vibe-Trading classes, session IDs, memory files, config formats, or trading connector identifiers.
4. Vibe-Trading trading connectors, live channels, shell/file tools, and local secret handling are outside the TP01 adoption scope and remain denied by default.

### Traceability chain

Every accepted sync must be traceable through the following chain:

`upstream SHA -> third_party/vibe-trading/baseline.lock.json -> fork patch queue / decision record -> adapter image digest -> release manifest`

The read-only checkout must use remote name `upstream`, the official fetch URL,
and push URL `DISABLED`. The controlled fork must use `origin` for the SumAlpha
repository and the same read-only `upstream`. Run `make tp01-vibe-readonly-check`
for the repository-pinned evidence and `make tp01-vibe-repository-check` in an
authenticated environment for the real fork evidence.

### Sync policy

| Severity | Meaning | Required action |
| --- | --- | --- |
| `S0` | Security response | Immediate decision record, candidate branch, and blocking review |
| `S1` | Compatibility or license response | Decision record plus contract / license re-check before merge |
| `S2` | Planned sync | Candidate review queued through TP01 workflow and regression plan |
| `S3` | Research-only drift | Candidate record only; no default capability exposure |

The scheduled monitor at `.github/workflows/tp01_vibe_upstream_monitor.yml` produces candidate artifacts only. It must never update production dependencies automatically.
