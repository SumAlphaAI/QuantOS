# ADR: TP11 OpenStock — reference only and real data denied

## Status and scope

Bounded engineering evaluation refreshed 2026-10-11; formal ACCEPTED remains unregistered. Baseline `Open-Dev-Society/OpenStock@4597c9a668118844b588f95eddb9342eed31c41d`, project classification AGPL-3.0-only. Public license, README, descriptors and API/market-support documents were read in memory; no upstream code/assets retained or application/dependencies executed. See [provider comparison](../../third_party/openstock/provider-comparison.md) and [public observations](../../third_party/openstock/provenance.json).

## Decision

1. `reference_only`, runtimeAdmission=DENIED, productionApproved=false. QuantOS policy permits owned documentation and offline synthetic contract experiments, and prohibits source absorption, Day-1 dependencies and hosted reuse absent a separate decision. This is a project admission decision, **not** a statement that AGPL universally makes hosting legally impossible.
2. Real Finnhub data is denied pending verified written business/use/redistribution rights. [Official terms](https://finnhub.io/terms-of-service) do not authorize business internal research merely because a free/personal tier is available. Synthetic fixture rights belong to QuantOS; their label grants no rights to provider or publisher content. Remove the historical automatic “free tier research-only” assumption.
3. TradingView widgets are display references, not a data API or extraction source. [Official FAQ](https://www.tradingview.com/widget-docs/faq/data/) offers no export or data-access API. ADANOS and AI content have no admitted data-rights/provenance path.
4. Two owned positive Finnhub-shaped samples and a separate TradingView rejection sample cover lineage/quality mapping. The positives actually round-trip `DataSnapshot` protobuf and generated JSON schema; raw/normalized/lineage hashes are real byte digests. There is **no enabled TP05 Finnhub provider**. Quote lacks volume and news lacks a current TP05 record schema; both require reviewed provider/schema extensions. No missing market field is invented.
5. The offline intake denies real origin, unrecognized license, unknown/display providers, non-test/non-research use and nested authority before constructing any usable snapshot/Artifact. Actual F05 Gate tests enforce its present metadata/quality/freshness semantics. F05 is not a legal registry, and does not consume `trading_approved`; fresh synthetic news can pass its structural strict checks. Combined intake still rejects strategy/trading. Keep these controls distinct.
6. OpenStock watchlist/research-display and documented automation are design references only. No UI, account database, alerts, backtest, signal or execution runtime is delivered by this evaluation. Documented roadmap paper trading is not shipped evidence.
7. The historical npm report remains evidence of 39 findings, including five direct entries. Correct the prior all-transitive claim and invalid Git-SHA-as-SHA256 SPDX field. Current resolved graph/CVE clearance remains NOT_ASSESSED, and runtime is denied independently.

## Replacement cost and future admission

A future provider requires written market/news data rights for the actual tenant, dataset, use, retention and redistribution; an owned TP05 provider implementation and schema extension; numeric/time/source/hash/quality validation; scope/cache/cancellation tests; persistent artifact and deployed authorization evidence. Cost exceeds adding an API URL: current OHLCV schema cannot accept quotes lacking volume, and no news schema exists. Neither upstream AGPL admission nor data-rights approval is implied by this evaluation.

Reimplement any display pattern in the owned terminal against admitted APIs and page Gates. Do not copy upstream components, assets, auth/data models or event pipelines. Public documentation is static, unexecuted evidence; no availability or investment-quality claim follows.

## Acceptance boundary

TP11 development admission requires fresh `CORE:TP05` and `CORE-GATE:F0` receipts, component execution logs, exact supporting bytes and recursive content checks. Engineering evidence cannot self-approve formal user confirmation, same-SHA hosted CI, deployment, production, current CVE or data-use rights. No production credentials, real provider query or external publication is authorized or performed.

Only the two exact fixture digests registered in the owned experiment are accepted. Self-asserted synthetic origin/license plus a recomputed hash cannot admit arbitrary data; modifying the registry is a functional source change that invalidates current receipts. This registry is offline test scope, not deployed data-use authority.
