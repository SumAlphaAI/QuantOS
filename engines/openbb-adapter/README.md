# TP05 controlled data query adapter

QuantOS owns this deterministic fixture implementation of `data.query.v1`, its five local UDS Engine RPCs and its versioned JSON Data Contract. The OpenBB reference is pinned by `third_party/tp05-openbb/baseline.lock.json` to tag 4.4.5 / commit 34de2f61427f2879df4ebbf5906ca0508c6e84f3. It is descriptor-only, with unresolved upstream dependency/CVE and legal review, `productionApproved=false`. This package does not import or execute OpenBB or use a live external data provider.

The `mock` replacement and `openbb` evaluation labels both return QuantOS-controlled synthetic fixtures. Every response has sources, software-license and separate synthetic-data-use labels, versioned dataset-record schema (canonical bytes SHA-256), scoped lineage, a fixture digest and complete-byte normalized/lineage Artifact hashes. Response hashing excludes `response_hash` itself and canonicalizes integral protobuf Struct numbers. Neither the AGPL software label nor a reference URL grants real dataset rights. Data are historical fixture replays; live freshness and source authenticity are not assessed.

Research mode, granted capability and local/test Engine environment are required. Provider/dataset/schema/symbols must match a known fixture. The `openbb` label additionally requires the evaluation target and current evaluation permission. Trading use, production/staging environments, authority overrides, recursive order/venue/secret/network fields and unapproved tools fail. Allowed tool labels are never executed. Denial logging uses machine codes and caller-scope hashes, without raw payloads.

The provider cache is a monotonic-TTL LRU bounded to 128 entries. Keys bind tenant, workspace, actor, workflow, complete input/metadata and fixture/license-policy digests. Cached results are copied on read, and the license gate runs before hits. Two byte-readable immutable mock Artifacts commit atomically with the same lock as scoped cancellation. Deadlines and transport cancellation stop before final publication. Cache, execution state, Artifact bytes and logging are in-memory; this is not persistent audit or an OS egress sandbox.

```sh
node engines/openbb-adapter/check-development.mjs --record
node scripts/provider-a1-receipts.mjs --assess-tp05 docs/audit/evidence/provider-a1-remediation-20261004/tp05-admission-20261010/attempt-01
node engines/openbb-adapter/check-development.mjs --admit
node engines/openbb-adapter/check-development.mjs --ready
node --test scripts/tp05-release-gate.test.mjs
```

`make build-python` produces development/evaluation wheels. `make build-python-production` rejects the workspace while it contains this evaluation-only artifact, before dependency sync or wheel generation. Production build-manifest generation (`--production` or `QUANTOS_BUILD_PROFILE=production`) uses the same exclusion gate. Inventories containing any OpenBB artifact are rejected; an inventory without OpenBB passes only this task's exclusion check. Nothing here approves an entire production release. No upstream package enters the Python workspace lock.

Installed-wheel `-I` subprocess checks prove five RPCs, license denial, missing upstream package and <2s cancellation. The local UDS cancellation transcript is passed to the Research UI state handler; deployed BFF HTTP/browser E2E is not covered. DEVELOPMENT READY requires the fresh strict dependency closure; formal ACCEPTED, hosted CI, deployment and release remain separate.
