# TP01 V0-V1 Progress Tracker

## Objective

Track TP01 execution against the Development Plan baseline for:

- `TP01-A` upstream read-only mirror and controlled fork baseline
- `TP01-B` capability inventory and forbidden-coupling controls
- `TP01-C` `vibe_adapter` skeleton and contract harness
- `TP01-D` selective absorption and minimal patch queue
- `TP01-E` sync automation and graded blocking
- `TP01-F` canary, observability, and rollback automation
- `TP01-G` upstream contribution and decoupling replacement

## Milestone board

| Milestone | Status | Evidence | Notes |
| --- | --- | --- | --- |
| TP01-A 上游只读副本与 Fork 基线 | completed | `UPSTREAM.md`, `third_party/vibe-trading/*`, `forks/vibe-trading/*`, `.github/workflows/tp01_vibe_upstream_monitor.yml`, `scripts/check-vibe-upstream.mjs` | repo-local baseline, digest lock, branch protection policy, and candidate monitor are in place |
| TP01-B capability inventory 与禁止耦合清单 | completed | `docs/operations/tp01_vibe_inventory_and_threats.md`, `docs/adr/20260730-tp01-vibe-boundaries.md` | capability matrix, threat model addendum, and explicit deny list recorded |
| TP01-C `vibe_adapter` skeleton | completed | `engines/vibe-adapter/*`, `engines/tests/test_vibe_adapter_contract.py`, `crates/quantos-engine-manager/tests/python_vibe_adapter.rs` | manifest, UDS gRPC server, context translator, Artifact API facade, tool allowlist, fixture replay, and cross-language contract tests are in place |
| TP01-D 选择性吸收与最小 patch 队列 | completed | `engines/vibe-adapter/*`, `forks/vibe-trading/patch-queue/*`, `docs/adr/20260730-tp01-vibe-selective-absorption.md` | 20 个代表性 fixture 已可回放；workflow/streaming 选择性吸收已模块化；adapter 缺席不影响其他 workflow 路由 |
| TP01-E 同步自动化与分级阻断 | completed | `scripts/sync-vibe.mjs`, `scripts/sync-vibe-lib.mjs`, `scripts/tests/sync-vibe.test.mjs`, `.github/workflows/tp01_vibe_sync_gate.yml`, `forks/vibe-trading/sync-decisions/*` | S0-S3 分级、diff/range-diff 摘要、candidate issue、decision record 和阻断流水线均已落地；API 破坏、许可证变化、CVE、patch 冲突均可正确分级 |
| TP01-F canary、观测与回滚 | implemented | `scripts/tp01-vibe-canary.mjs`, `scripts/tp01-vibe-rollback.mjs`, `scripts/tp01-vibe-rollout-lib.mjs`, `docs/operations/tp01_vibe_canary_*`, `docs/runbooks/tp01_vibe_adapter_rollback.md`, `.github/workflows/tp01_vibe_canary_gate.yml` | capability flag、shadow-task 指标、阈值告警、签名制品与 one-click disable/rollback 自动化已落地；7 天 healthy canary 与 ≤5 分钟 rollback 为仓库内 drill evidence，真实线上观察期仍待执行 |
| TP01-G 上游贡献与脱钩替换 | implemented | `engines/vibe-adapter/src/vibe_adapter/protocols.py`, `engines/vibe-adapter/src/vibe_adapter/providers.py`, `engines/tests/test_vibe_adapter_contract.py`, `docs/operations/tp01_vibe_deprecation_plan.md`, `forks/vibe-trading/upstream-prs/*` | workflow/streaming/audit 已改为依赖 QuantOS-native contract/provider；provider 替换测试已覆盖；上游 PR 记录和 deprecation plan 已落地，真实 upstream PR 提交仍待远端执行 |

## Status updates

### Update 1: TP01-A completed

- fixed upstream repo, tag, commit, license, notice, and dependency digests;
- created the read-only reference ledger under `third_party/vibe-trading/`;
- created the controlled-fork governance baseline under `forks/vibe-trading/`;
- added a scheduled candidate monitor that records drift without mutating production dependencies.

### Update 2: TP01-B completed

- mapped workflow, skill, MCP, memory, tool, streaming, UX, channel, and trading surfaces to QuantOS boundaries;
- recorded forbidden couplings and threat scenarios;
- locked the adoption rule: only adapter-side QuantOS contracts may reach production.

### Update 3: TP01-C completed

- implemented `engines/vibe-adapter` with a QuantOS-native manifest, UDS gRPC service, context translator, tool allowlist, Artifact API facade, and deterministic replay fixture;
- passed all five Engine RPC contract checks in Python and Rust harnesses;
- added negative tests that reject forbidden tool, venue, secret, and network-adjacent inputs before any upstream sync work is admitted.

### Update 4: TP01-D completed

- expanded `vibe-adapter` into selective absorption modules for workflow planning, streaming projection, fixture catalog replay, and QuantOS-native audit wrapping;
- admitted 20 representative research fixtures through a deterministic replay catalog and verified them in Python contract tests;
- recorded the minimal patch queue and selective absorption ADR, and proved mock-engine workflows still route correctly when `vibe-adapter` is absent.

### Update 5: TP01-E completed

- implemented `sync-vibe` classification automation with shared library logic for S0-S3 grading, blocking, diff summaries, range-diff overlap, candidate issue drafts, and decision records;
- added simulation fixtures and Node tests covering API breakage, license drift, CVE escalation, patch conflict, planned sync, and research-only drift;
- wired the TP01-E sync gate workflow so CI validates both scenario simulations and the live upstream candidate report.

### Update 6: TP01-F implemented

- implemented TP01 canary policy, capability flag state generation, shadow-task and rollout threshold evaluation, signed release-manifest/drill artifact flow, and one-command disable / rollback automation;
- added dashboard and alert-rule definitions for canary health, shadow consistency, signed artifacts, rollback SLA, and audit completeness;
- added healthy 7-day canary, breach-disable, and rollback-drill scenarios plus CI automation, while keeping the final live 7-day observation as an operational step outside repository simulation.

### Update 7: TP01-G implemented

- introduced a QuantOS-native `ResearchExecutionContract` / `ResearchContractProvider` boundary so workflow planning, streaming projection, and audit wrapping no longer depend on catalog-specific fixture types;
- added replacement tests that swap the catalog provider for an in-memory provider while preserving the same QuantOS business protocol and stream phases;
- recorded the TP01 deprecation plan and two upstream contribution candidates for deterministic stream projection and pre-dispatch boundary validation.

## Open items for V1 planning

1. execute the live 7-day canary window and attach production drill evidence to the sync decision ledger;
2. provision the private fork remote and open / track the recorded upstream PR candidates;
3. rerun the blocked upstream CVE audit on a clean Python 3.11+ audit host;
4. remove deprecated compatibility aliases once all downstream consumers move to `provenance` and `design_capabilities`.
