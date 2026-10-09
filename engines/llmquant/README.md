# llmquant

TP03 controlled Research adapter exposing `quant.signal.v1` through all five Engine RPCs over UDS. LLMQuant is a third-party project identity. No external upstream/version/commit or trained weights have been selected; this QuantOS implementation uses three locked, deterministic fixtures. The existing intake lock is unchanged; its native implementation approval does not authorize an external runtime or deployment.

Execute/StreamExecute require a strategy release reference, a feature snapshot matching the request snapshot reference, Research mode and the matching actor capability. Recursive OMS/venue/secret/network/authority fields and unapproved tools are rejected. `query_snapshot` / `query_artifact` are recorded requests only: no tools execute, release objects or snapshot bytes resolve here, or trading authority is granted. Optional TP05 metadata remains untrusted provenance; production/trading flags must be false.

Each result contains a QuantOS Signal, strategy/model/data versions, confidence, a bounded validity window, factor families and model diagnostics. The model digest authenticates the fixture definition, not trained model weights. Time uses the command's bound `issued_at` plus fixture TTL to support controlled historical Research replay; it does not prove wall-clock freshness. Runtime/consumers must validate trusted release/snapshot references, quality and current usability.

Signal/model Artifact bundles contain immutable, readable JSON bytes with actual full-byte SHA256 refs and tenant/workspace/actor isolation. `mock-artifact://` denotes the in-memory store; no Supabase upload or durable audit is implied. Cancellation and bundle commit share a lock. Owner-scoped Cancel, active command/transport deadlines and execution identity conflict checks apply to unary and streaming RPCs.

Run the development checks:

```sh
node engines/llmquant/check-development.mjs --record
node --test scripts/tp03-functional-artifacts.test.mjs
```

The recorder checks 100 inputs with double unary and streaming replay, actual JSON Schema, Python/Rust contracts, an independently installed wheel process, stream cancellation under two seconds, and the Research UI response bridge. The bridge reuses an actual local UDS cancellation transcript; deployed BFF HTTP/browser E2E remains separate. Without the explicit bridge environment, normal web tests intentionally skip that one integration test.

`--record` is engineering evidence only. `--admit` / `--ready` require the unified current-content TP03/F08/F05/F0 dependency receipts. Representative deployment load, OS egress enforcement, persistence, real feature/model computation, upstream runtime, hosted CI and formal acceptance remain outside this gate. See [development report](../../docs/audit/TP03-development-2026-10-10.md).
