# TP11 Progress Ledger — OpenStock Evaluation

## Status

`implemented` — evaluation complete with conclusion `reference_only` (no Day-1 dependency, no lockfile entry).

## Deliverables

| Deliverable | Location | Status |
| --- | --- | --- |
| Baseline lock (fixed commit, license, digests) | `third_party/openstock/baseline.lock.json` | done |
| Provider comparison | `third_party/openstock/provider-comparison.md` | done |
| SBOM (SPDX) | `third_party/openstock/sbom.spdx.json` | done |
| CVE audit record + raw evidence | `third_party/openstock/cve-audit.md`, `cve-audit-npm-audit.json` | done (`completed_with_findings`: 2 critical / 13 high / 24 moderate) |
| Fixture 01: Finnhub quote -> Data Contract (+ unauthorized variant) | `third_party/openstock/fixtures/01-finnhub-quote-to-data-contract.json` | done |
| Fixture 02: Finnhub news -> Data Contract (+ widget rejection case) | `third_party/openstock/fixtures/02-finnhub-news-and-widget-rejection.json` | done |
| Executable validation (contract, gate recompute, replay) | `engines/tests/test_tp11_openstock_fixtures.py` | done |
| Evaluation ADR (license conclusion + replacement cost) | `docs/adr/20260731-tp11-openstock-evaluation.md` | done |

## Pinned baseline

- Upstream: `Open-Dev-Society/OpenStock`
- Commit: `4597c9a668118844b588f95eddb9342eed31c41d` (2026-07-04; package version `0.1.0`)
- License: AGPL-3.0-only (network copyleft — reference only)

## Acceptance mapping

| Plan requirement | Evidence |
| --- | --- |
| 2 个 provider fixture 完成血缘/质量映射 | `fixtures/01-02` + `test_lineage_and_quality_mapping_present_in_both_fixtures` |
| 任何未授权数据无法生成可用 DataSnapshot | `test_unauthorized_data_never_produces_usable_snapshot`（对 unauthorized variant 与 widget case 重算 F05 gate，100% 拒绝） |
| 无 Day-1 依赖 | `baseline.lock.json` policy `forbiddenSurfaces`；QuantOS lockfile 零改动（git diff 验证） |
| provider comparison | `provider-comparison.md`（Finnhub / TradingView widgets / ADANOS / AI providers 对照 TP05 Data Contract 要求） |
| 许可证结论 | ADR decision：上游 AGPL-3.0-only；Finnhub free tier research-only；widget/ADANOS 拒绝 |

## Open follow-ups

1. npm audit 发现 2 critical / 13 high（全部经由 inngest/opentelemetry/grpc 传递依赖）；仅作监控，除非重新评估否则无需处理。
2. 若 R1 需要 Finnhub 级市场数据，通过 TP05 `data.query.v1` 按本次 fixture 契约接入，并先完成商业许可决策。
