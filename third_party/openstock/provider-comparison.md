# TP11 OpenStock Provider Comparison

Baseline: `Open-Dev-Society/OpenStock@4597c9a668118844b588f95eddb9342eed31c41d` (AGPL-3.0-only).

Scope: evaluate OpenStock's market-data and research-display surfaces against TP05 Data Contract requirements (source, license, schema, lineage, hash, quality, trading-approval gate).

## Providers used by OpenStock

| Provider | Role in OpenStock | Data classes | License / terms posture | Delay / quality posture | QuantOS fit | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Finnhub (`finnhub.io/api/v1`) | symbols, profiles, quotes, market news | quotes, company profiles, market news | free tier requires attribution and forbids redistribution/derived trading products; real-time and redistribution need paid commercial terms | free tier is delayed (per provider rules); no per-record quality metadata | maps cleanly onto TP05 Data Contract as research-only provider; see fixture 01/02 | reference (research-only candidate via `data.query.v1`, pending commercial decision) |
| TradingView widgets | charts and market views | rendered chart/market widgets | display-only embed license; **not a data API** — no extraction or redistribution rights | n/a (rendered client-side) | cannot produce a DataSnapshot at all; see fixture 02 rejection case | reject as data source |
| ADANOS (optional, `api.adanos.org`) | optional data backend | operator-configured | indeterminate; no license manifest in repo | indeterminate | no verifiable license => fails `require_license` gate | reject until license manifest exists |
| AI providers (Gemini / MiniMax via multi-provider fallback) | generative research summaries | AI-generated text | provider terms govern output; no provenance for embedded claims | n/a | same posture as TP09: research-only, never a signal source | reject as data source |

## Comparison against TP05 Data Contract requirements

| Requirement | Finnhub free tier | TradingView widgets | ADANOS optional |
| --- | --- | --- | --- |
| per-source attribution (`sources[]`) | partial: provider+dataset known, no per-record source id | none | unknown |
| license label (`license.label`) | derivable from tier terms (`finnhub-free-attribution-research-only`) | none available | none available |
| schema/hash (`lineage.schema_hash`, `content_hash`) | computable after normalization (fixture demonstrates) | n/a | n/a |
| quality mapping (`quality.status`, delay metadata) | mappable: delayed => `degraded` for strategy/trading, `passed` for research | n/a | n/a |
| production approval (`approved_for_production`) | false without commercial terms | false | false |

## Conclusion inputs for the ADR

1. Only Finnhub is a credible future `data.query.v1` provider candidate, and only as research-only until commercial terms exist.
2. TradingView widgets and ADANOS cannot produce usable DataSnapshots: no redistributable license and no per-source attribution.
3. OpenStock's own display/UX layer (watchlist, research views) is design reference for U-series work, not a data path.
