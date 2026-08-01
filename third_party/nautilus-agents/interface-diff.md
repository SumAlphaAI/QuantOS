# TP12 Interface Diff — nautilus_agents vs QuantOS Contracts

Baseline: `nautechsystems/nautilus_agents@8d79877380f8617b45dff2b8c8b3790c2f9d963a` (crate 0.2.0, protocol 1.0, LGPL-3.0-or-later).

Scope: surface-by-surface diff between the upstream agent-kernel collaboration protocol and QuantOS-owned contracts. "Aligned" means the same boundary principle; "diff" marks a real semantic difference; "adopt" marks a candidate pattern worth absorbing.

## 1. Observation / input surface

| Aspect | nautilus_agents | QuantOS | Verdict |
| --- | --- | --- | --- |
| who constructs observations | engine (NautilusTrader) owns construction; agent receives a versioned `Observation` with digest | F05 snapshot catalog + TP03/TP05 engines own construction; agents receive versioned snapshots/signals | aligned |
| integrity | per-field digest coverage metadata (`fields.toml`, `digest_covered`) | content hash on snapshots/artifacts; no per-field ownership metadata | adopt (field ownership/retention metadata candidate) |
| versioning | independent `ProtocolVersion { major, minor }` | schema_version (`v1`) on contracts + engine manifests | aligned |

## 2. Proposal surface

| Aspect | nautilus_agents | QuantOS | Verdict |
| --- | --- | --- | --- |
| what agents may emit | at most one semantic live proposal; protocol 1.0 allows only `ReducePosition` | `TradeProposal` with buy/sell/hold/reduce, always `executable=false` (TP04/R04) | aligned in principle; diff: QuantOS actions are richer but equally non-executable |
| execution authority | NautilusTrader decides handling of accepted proposals; agent has no venue authority | TP07 execution gateway + risk engine own every step; agents never reach the kernel | aligned — upstream model **confirms** the QuantOS "Agent never connects to a venue" boundary |
| expiry | advisory checks include expiry validation | `TradeProposalEvaluationGate` + gateway `CommandExpired` rejection (authoritative) | aligned; diff: QuantOS enforcement is authoritative, upstream is advisory-at-agent + authoritative-at-engine |

## 3. Client / transport boundary

| Aspect | nautilus_agents | QuantOS | Verdict |
| --- | --- | --- | --- |
| transport | transport-neutral `AgentClient` trait (submit/receipt) | F08 engine UDS gRPC + TP07 `ExecutionKernel` trait | diff in layer, aligned in principle: both isolate policy/agent code from transport |
| failure model | request-level rejection is a successful response, not a transport error | gateway/kernel errors are typed (`GatewayError`, stable machine codes) | aligned |

## 4. Assurance / evidence surface

| Aspect | nautilus_agents | QuantOS | Verdict |
| --- | --- | --- | --- |
| local checks | `AdvisoryValidator` — findings only, never decisions; engine may still reject | X02 risk engine is authoritative; agent-side diagnostics are advisory metadata | aligned (advisory vs authoritative naming worth adopting explicitly) |
| traces | `AgentTrace` (agent-side) vs `DecisionReceipt` (public outcome) | runtime workflow records + audit events (F06) vs `GatewayOrder/GatewayFill` (TP07) | aligned |
| recording | `TraceRecorder` with retention classes: `ReferenceOnly` / `Redacted` / `Full`; `Restricted` data rejected in Redacted/Full | artifact store with content-hash dedup; telemetry redaction (F09); no retention-class metadata on records yet | adopt (retention classes candidate for agent evidence recording) |
| replay evaluation | `ShadowEvaluator` compares two policies over the same observation | deterministic fixture replay across engines (TP01–TP05) + R04 replay stability | aligned |

## 5. Contract governance surface

| Aspect | nautilus_agents | QuantOS | Verdict |
| --- | --- | --- | --- |
| schema assets | generated JSON Schemas + RFC 8785 canonical fixtures (valid + reviewed invalid with expected errors) | F03 proto + JSON docs + roundtrip fixtures | aligned |
| field metadata | `fields.toml`: owner, stability, required, retention, digest coverage per field | no equivalent per-field metadata | adopt (strongest candidate: field ownership/retention/digest metadata for QuantOS contracts) |
| supply chain | cargo-audit/deny/vet, gitleaks, crates.io-only sourcing | `third_party/*` baselines with SBOM/CVE records | aligned |

## 6. Anti-patterns confirmed (do not copy)

1. **Agent-side production authority** — upstream explicitly rejects it; any design letting agent local checks bypass the engine is an anti-pattern.
2. **Rich live intents** — upstream allows exactly one semantic intent; expanding agent intents without expanding authoritative gates is an anti-pattern.
3. **Unversioned observation sharing** — passing raw/live state instead of digest-covered versioned observations breaks replay and audit.
4. **Agent traces as production evidence** — traces are agent-side evidence only.
5. **Recording restricted payloads** — recording modes must reject restricted retention classes instead of redacting silently.

## 7. Summary

The upstream design independently converges on the QuantOS boundary: agents propose narrow semantic actions over engine-owned observations, the engine owns every production decision, and no venue authority ever reaches the agent process. Three patterns are candidate adoptions (retention classes, per-field ownership/digest metadata, explicit advisory-vs-authoritative naming). Nothing requires a runtime dependency.
