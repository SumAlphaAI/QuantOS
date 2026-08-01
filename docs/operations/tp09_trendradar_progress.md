# TP09 Progress Ledger — TrendRadar Evaluation

## Status

`implemented` — evaluation complete with conclusion `reference_only` (no adapter, no lockfile entry).

## Deliverables

| Deliverable | Location | Status |
| --- | --- | --- |
| Baseline lock (fixed commit, license, digests) | `third_party/trendradar/baseline.lock.json` | done |
| Data license inventory （数据许可清单） | `third_party/trendradar/data-license-inventory.json` | done |
| SBOM (SPDX) | `third_party/trendradar/sbom.spdx.json` | done |
| CVE audit record | `third_party/trendradar/cve-audit.md` | done (status `blocked`, follow-up required) |
| Mapping sample 01: hot-list theme -> Signal | `third_party/trendradar/mappings/01-hotlist-theme-to-signal.json` | done |
| Mapping sample 02: RSS theme -> Signal | `third_party/trendradar/mappings/02-rss-theme-to-signal.json` | done |
| Mapping sample 03: missing license/source -> non-tradable Signal | `third_party/trendradar/mappings/03-missing-license-non-tradable.json` | done |
| Executable validation of mapping samples + non-tradable rule | `engines/tests/test_tp09_trendradar_mapping_samples.py` | done |
| Evaluation ADR (conclusion + replacement cost + marking rule) | `docs/adr/20260731-tp09-trendradar-evaluation.md` | done |

## Pinned baseline

- Upstream: `sansan0/TrendRadar`
- Commit: `8ee26026ba6c11dec41a95fb3895a7162876caa1` (`mcp-v3.2.0-38-g8ee26026`, 2026-07-17; pyproject version `6.10.0`)
- License: GPL-3.0-only (copyleft — reference only)

## Acceptance mapping

| Plan requirement | Evidence |
| --- | --- |
| 3 组离线输入可映射至自有 Signal | `mappings/01-03` + Signal contract validation test |
| 缺少许可证/来源的输出 100% 被标为不可交易 | `test_degraded_inputs_are_always_non_tradable` + sample 03 markers; inventory rule field |
| 无生产依赖进入 lockfile | `baseline.lock.json` policy `forbiddenSurfaces`; no QuantOS lockfile touched; GPL-3.0 noted in ADR |
| 数据许可清单 | `data-license-inventory.json` (4 input classes, all `trading_approved=false`) |
| 趋势 signal schema 样例 | mapping samples carry full Signal fields incl. provenance diagnostics |
| ADR | `docs/adr/20260731-tp09-trendradar-evaluation.md` |

## Open follow-ups

1. CVE audit is `blocked` (local host bootstrap failure); rerun on a clean Python 3.12+ host for monitoring completeness.
2. If a licensed news provider is onboarded via TP05, add a fixture proving the same `not_tradable` marking rule for degraded records.
