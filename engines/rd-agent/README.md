# rd-agent

QuantOS-native TP02 hypothesis/experiment Engine. The approved intake replaces
upstream execution with deterministic fixtures. This package does **not** load
Microsoft RD-Agent, call an LLM, fetch market data or execute tools.
The upstream v0.5.0 baseline remains evaluation-only (`productionApproved=false`).

The five Engine RPCs run over UDS. Both execution RPCs accept only Research mode,
a matching actor capability, schema v1 and the SDK-required identity, snapshot,
policy and deadline fields. Only `prompt`, `fixture`, `tools` and `sleep_ms` are
accepted in JSON. Unknown fields, recursive authority/secret/trading/network
fields and tools outside `read_document`, `query_artifact`, `query_snapshot` are
rejected. Tools are recorded intentions, never executed. Sleep is a development
cancellation probe, an integer from 0 to 5000 ms.

`research.hypothesis.v1` selects `hypothesis_regime_shift` by default;
`research.experiment.v1` selects `experiment_factor_stability`. A fixture of the
wrong kind is rejected. Output is QuantOS `ResearchArtifact`, always
`trade_executable=false`, with input/prompt/catalog hashes, snapshot/policy refs
and tenant/workspace/actor/run/request/correlation/causation audit references.
Snapshot refs label fixed inputs; this Engine performs no data read. Trusted
snapshot resolution and quality/permission checks remain the existing Runtime /
R02 boundary. Output explicitly records `snapshot_bytes_resolved=false` and
`tools_executed=false`; an opaque ref alone is not proof of live data provenance.

Execution identity includes tenant, workspace, actor, run and idempotency key.
Reusing the same identity with changed payload, capability, snapshot, policy or
request/correlation/causation IDs returns `ALREADY_EXISTS`; retries reuse those
IDs. Cancel requires the same owner, Research mode and execution capability.
Waits and stream emissions check both command deadline and transport cancellation.
Artifact commit and Cancel share a lock so an acknowledged cancel cannot race a
later write. Cancellation after an already completed write does not erase it.

`ResearchArtifactStore` holds immutable JSON bytes in process memory. Repeated
Execute/StreamExecute returns the same content-addressed ref. The read facade
checks tenant, workspace and actor; refs use `mock-artifact://`, never a fictitious
Supabase upload. `ArtifactRef.sha256` hashes the actual stored full JSON bytes;
output `artifact_hash` hashes the deterministic document before adding that field.
This is a development facade: restart persistence and deployed read authorization
are not claimed. UDS is a trusted local caller boundary, not remote authentication.

Validation:

```sh
node engines/rd-agent/check-development.mjs --record
node --test scripts/tp02-functional-artifacts.test.mjs
node engines/rd-agent/check-development.mjs --admit
node engines/rd-agent/check-development.mjs --ready
```

`--record` checks five-RPC/negative/replay/stop behavior, all Python Engines,
Rust Manager and Runtime, wheel packaging, lint, format, types, locks and intake.
Packaging builds this Engine and SDK wheels, copies only the two already
lock-installed runtime distributions (grpcio 1.74.0 / protobuf 5.29.6) into a fresh
venv, installs the project wheels offline, verifies site-packages module paths,
and probes a separate child with `python -I`. No editable project path is added.
The owned child is always reaped. Packaged wheel bytes travel with the receipt.

Engineering-only verification returns `NOT_ASSESSED`. `--admit` additionally
requires the unified source/log/command/dependency manifest, F08 and F0. The
local response latency test is diagnostic; representative P95 <1s belongs to
RELEASE-GATE:BETA. OS network isolation, real tools/models, durable Artifact/audit,
deployment, sustained performance, hosted CI and formal acceptance are separate.
