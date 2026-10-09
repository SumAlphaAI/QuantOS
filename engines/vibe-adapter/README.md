# vibe-adapter

Controlled TP01 adapter skeleton for `HKUDS/Vibe-Trading`.

Current scope:

- QuantOS-native engine manifest for `vibe-adapter`
- UDS gRPC server implementing all five Engine RPCs
- context translator from `ExecuteRequest` to adapter-local execution context
- QuantOS-native `ResearchExecutionContract` / `ResearchContractProvider` boundary for replaceable research providers
- selective absorption modules for workflow planning, streaming projection, and audit wrapping
- research-safe tool allowlist
- tenant-scoped in-memory mock Artifact API with readable content, SHA-256 integrity and deterministic refs
- 20 replay-oriented research fixtures admitted through a catalog

Hard boundaries:

- no venue or broker connectivity
- no secret resolution
- no shell or arbitrary file mutation tools
- no upstream session or persistent memory store reuse

TP01-C is a **local mock skeleton**. `web_search`, `read_url`, and document/skill names
describe a fixture plan; this implementation does not invoke tools, LLMs or network
providers. Only `prompt`, `fixture`, `tools`, and bounded integer `sleep_ms` inputs
are accepted. An explicit empty `tools` list grants nothing. Context identity and
research capability come from validated Engine metadata supplied by the trusted
Manager; payloads cannot override tenant, workspace, actor or permissions.

The default `VibeArtifactApi` stores JSON bytes in process memory and returns
`mock-artifact://` URIs. It never claims a Supabase object exists. Replaying the
same tenant/run/kind/content produces the same ref; different tenants have
different IDs and cannot read each other's objects. Process exit discards stored
bytes. A durable QuantOS Artifact backend and trusted snapshot/policy resolution
belong to subsequent integration work, not this mock receipt.

Cancel is scoped to tenant, workspace and actor. Unknown or foreign executions are
denied. In-flight fixture waits check cancellation, RPC liveness and the Engine
deadline every 10ms; cancelled execution keys stay cancelled for this process.
Changed input/snapshot/policy with the same execution key is rejected. Provider
failures expose stable error codes; denied payload values are omitted from logs.
These in-memory maps are for bounded fixture runs, not a production registry.

Run from the repository root:

```sh
engines/.venv/bin/python -m vibe_adapter.server --socket /tmp/quantos-vibe-local.sock
engines/.venv/bin/python -m pytest engines/tests/test_vibe_adapter_contract.py engines/tests/test_vibe_adapter_skeleton.py -q
cargo test --locked --offline -p quantos-engine-manager --test python_vibe_adapter
node engines/vibe-adapter/check-development.mjs --record
node engines/vibe-adapter/check-development.mjs --verify
node engines/vibe-adapter/check-development.mjs --ready
node scripts/provider-a1-receipts.mjs --assess-tp01-c docs/audit/evidence/provider-a1-remediation-20261004/tp01-c-admission-20261009/attempt-01
node engines/vibe-adapter/check-development.mjs --admit
```

The CLI requires an absolute unused socket path, preserves existing files and
sets the new socket to mode `0600`. Remove a stale socket only after verifying its
owner process has stopped. Tests require local UDS binding permission.

`--record` runs all Python Engine and Rust Manager component regressions, lint,
format, type and lock checks, and records exact inputs/commands/log digests under
`docs/audit/evidence/tp01-c-20261009`. `--verify` checks those bytes against the
current source and independently revalidates TP01-B/F08/F0 dependency content.
`--ready` returns 2 while any dependency remains blocked, even when engineering
tests pass. No mode grants formal acceptance or runs database, deployment,
production credential, or publication actions. See the
[TP01-C report](../../docs/audit/TP01-C-skeleton-2026-10-09.md).

The unified `--assess-tp01-c` command assesses the necessary F01–F09/TP01-A/B/F0
closure plus TP01-C on clean committed source. Its database checks use only the
configured test Supabase and owned fixtures; it never starts a local database.
The TP01-C supporting snapshot validates local engineering before the assessor
publishes gates. That snapshot cannot grant READY by bypassing dependencies.
After strict unified admission, `--admit` refreshes the standalone dependency
view without rerunning unchanged mock checks. `--ready` then independently checks
the unified TP01-C manifest and its whole dependency chain.

The initial blocked logs/receipt are retained under `initial-blocked/`; see the
[dependency refresh report](../../docs/audit/TP01-C-development-admission-2026-10-09.md)
for current admission and source/evidence commit boundaries.
