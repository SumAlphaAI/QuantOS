# Upstream Registry

This file is the authoritative upstream dependency ledger for third-party intake tasks.

## TP01: Vibe-Trading

### Locked upstream baseline

| Field | Value |
| --- | --- |
| Upstream repository | `https://github.com/HKUDS/Vibe-Trading.git` |
| Browse URL | `https://github.com/HKUDS/Vibe-Trading` |
| Locked tag | `v0.1.13` |
| Locked commit | `c33133f4fd5e978d21d2a61fdd8787fb352b4687` |
| Observed upstream `main` at capture | `69b41987de76e04e92786adec3d4efa29e719a5a` |
| Baseline recorded at | `2026-08-13` |
| License conclusion | `MIT` |
| `LICENSE` SHA256 | `b155549b8bc4e43a9b96b2288dbf4eb1bc0c697f14b3f5ec6b36bf64d5a18679` |
| `NOTICE` SHA256 | `a898503c041b27d1046748144666a1309b6b25fa4d75a1b0a06ce2f8acd3b07c` |
| `pyproject.toml` SHA256 | `1ac63259fd6e94173c41f7e956c6310183861d31ab33743d646c16d5a39c3b64` |
| `requirements-lock.txt` SHA256 | `ccb225f8ae17888dc181cb788f46564ee1b9e930cc69cfc8eac8087871cc23ec` |
| Read-only reference path | `third_party/vibe-trading/upstream-src` (pinned Git submodule) |
| Controlled fork URL | `https://github.com/sumalphai/Vibe-Trading.git` |
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
