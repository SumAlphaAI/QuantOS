# TP01 V0 Capability Inventory And Threat Model Addendum

## Scope

Baseline analyzed against `HKUDS/Vibe-Trading` tag `v0.1.12` (`43331c3221be37c5cc1ed8dddc4c7988bcddc5cd`).

Evidence sources used for V0:

- upstream `README.md`, `pyproject.toml`, `LICENSE`, `NOTICE`, `requirements-lock.txt`
- directory manifests for `agent/src/{skills,tools,memory,session,swarm,channels,shadow_account}`
- frontend routing and SSE hook
- upstream MCP / session / event bus / smoke-test sources

## Capability matrix

| Capability | Upstream surface | Inputs | Outputs | Side effects | Network / secret / storage | Test evidence | QuantOS treatment |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Research workflow orchestration | `agent/src/session`, `agent/src/agent`, `agent/src/goal` | user prompt, session config, optional MCP config | assistant messages, attempt metadata, run directories | creates sessions, attempts, SSE events, filesystem state | local session store, local runs directory | `test_session_*`, `test_goal_*` | absorb patterns only; rewrite as QuantOS Runtime workflow + Artifact API |
| Finance skills corpus | `agent/src/skills/*` | prompt + market context | markdown guidance, code templates, research heuristics | none by itself, but can steer tool execution | no direct storage; may imply external data calls | `test_skills.py`, skill-specific tests | selectively reference methodology docs; no direct skill runtime import |
| MCP server | `agent/mcp_server.py` | MCP initialize / tool calls | 54-tool MCP surface, stdio / SSE / HTTP responses | serves tool catalog, invokes tools, emits streaming responses | external MCP transport, optional external MCP client loading | `test_mcp_*`, `test_mcp_server_smoke.py` | adapter may expose QuantOS-native MCP subset only; no direct upstream MCP server embedding |
| Persistent memory | `agent/src/memory/persistent.py` | user / project memory entries | memory index, recalled snippets | writes `~/.vibe-trading/memory/*.md` | local file storage, cross-session retention | `test_persistent_memory.py`, `test_remember_tool*.py` | reject storage model; QuantOS memory must remain Artifact / policy scoped |
| Tool registry | `agent/src/tools/__init__.py` plus 50+ tools | tool args, session id, memory handle | tool-specific JSON / text | file IO, shell, web fetch, document reads, goal mutation | mixed network, local filesystem, optional shell access | `test_registry*.py`, tool-specific security tests | only allow listed research-safe tools after adapter rewrite; deny shell / write / local file mutation / broker placement |
| Trading connectors | `agent/src/tools/trading_connector_tool.py`, `agent/src/trading`, `agent/src/live` | connector profiles, broker auth, account identifiers | account / positions / orders / quotes, optional order flow elsewhere | broker connectivity, live account reads, possible order paths in non-MCP surfaces | broker credentials, network to venues / brokers | `test_trading_*`, `test_killswitch_blocks_orders.py`, `test_sdk_order_gate.py` | forbidden for TP01; QuantOS execution stays behind `TradeCommand` boundary only |
| Swarm / multi-agent teams | `agent/src/swarm/*`, 30 presets | research prompt, preset, LLM config | multi-agent report, task summaries | spawns workers, background coordination, task persistence | LLM API keys, local task store, optional network tools | `test_swarm_*` | borrow orchestration ideas only; implement via QuantOS Runtime and Engine Manager contracts |
| Shadow account workflow | `agent/src/shadow_account/*` | trade journal CSV, market data, templates | extracted rules, backtest result, report | parses uploads, writes artifacts, renders reports | network for data sources, local templates / storage | `test_shadow_*`, `test_trade_journal.py` | potential future research fixture source only; no direct admission in V0 |
| Streaming UX | `agent/src/session/events.py`, `frontend/src/hooks/useSSE.ts` | SSE events, last-event-id, auth ticket | incremental UI updates, reconnect state | keeps buffered event stream, reconnect loop | auth ticket transport, buffered per-session events | `test_session_events.py`, `test_sse_ticket_and_headers.py` | good reference for Research streaming UX; must map onto QuantOS event / projection model |
| Frontend IA | `frontend/src/router.tsx`, pages `Home/Agent/Runtime/Reports/Settings/RunDetail/Compare/Correlation/AlphaZoo` | session/run ids, route state | shared research UI | browser-side state and SSE subscription | browser network to API server | frontend page and SPA tests | use as UX reference only; replace data and auth contracts with QuantOS BFF / policy model |
| Channels / IM surfaces | `agent/src/channels/*` | webhook events, chat messages, pairing state | external notifications / replies | third-party message delivery, pairing, websocket flows | channel secrets, network egress, local cache | `test_channels_*`, `test_cli_channels.py` | out of TP01 scope; deny by default |

## Forbidden coupling list

1. Upstream session IDs, attempt IDs, run directory layout, and SSE event names are not QuantOS contracts.
2. Upstream persistent memory files under `~/.vibe-trading/memory` must not become QuantOS state, import format, or migration source.
3. Upstream trading connector profiles, broker auth caches, and order-related service calls are prohibited in TP01.
4. Upstream shell, write-file, edit-file, local document mutation, and arbitrary background-run tools are prohibited in TP01.
5. Upstream frontend route schema, browser auth ticket flow, and client-side stores are not stable QuantOS APIs.
6. Upstream Alpha Zoo / factor / research content may require nested attribution and license review before any adapter-side extraction.

## Threat model addendum

### Assets at risk

- QuantOS tenant-isolated research artifacts
- QuantOS runtime sessions and audit chain
- execution-boundary secrets and venue credentials
- workspace filesystem and developer machine trust
- release reproducibility evidence

### Additional threat scenarios introduced by TP01

| Threat | Upstream trigger | Impact if unmitigated | V0 control |
| --- | --- | --- | --- |
| Secret leakage into research engine | upstream connectors, channel adapters, MCP auth caches | credential disclosure, cross-boundary compromise | deny all upstream secret and broker surfaces; adapter may receive only QuantOS references |
| Cross-tenant state bleed | persistent memory, session store, local run directories | tenant isolation break | forbid upstream storage model and rebuild on QuantOS Artifact / auth context |
| Arbitrary code or shell execution | shell / file mutation tools | workstation compromise or unreviewed side effects | remove from allowlist; negative fixtures required in V1 |
| Hidden network egress | market data providers, channels, MCP clients | policy bypass, data exfiltration | adapter network deny-by-default with explicit research-safe allowlist only |
| Contract drift masked by upstream UX | upstream route / SSE / session semantics | brittle integration, replay failure | define QuantOS-native Engine RPC and event contracts only |
| License drift in nested content | NOTICE-bearing factor packs, packaged assets | redistribution non-compliance | locked digests + scheduled candidate monitor + mandatory license review |

### V0 security posture

- `accepted for reference`: research workflow decomposition, streaming UX ideas, MCP surface shaping patterns
- `accepted only after adapter rewrite`: research-safe tool semantics, replayable workflow fixtures
- `rejected by default`: trading connectors, live channels, persistent memory store, local shell and file mutation tools, channel adapters, upstream auth/session persistence

### V1 entry criteria derived from this addendum

1. negative test set must reject secret, venue, shell, file, unauthorized network, and cross-tenant requests;
2. adapter must use QuantOS Artifact API as its only read/write persistence surface;
3. upstream failures may surface only controlled QuantOS errors, never raw path or credential material;
4. removing the adapter must leave other QuantOS Runtime workflows bootable.
