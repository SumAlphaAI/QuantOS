# TP05 OpenBB Adapter Progress

## Status

`implemented`

## Delivered scope

- `engines/openbb-adapter` package with QuantOS-native manifest, request adapter, deterministic fixtures, isolated provider abstraction, mock replacement provider, license gate, and UDS gRPC server;
- support for `data.query.v1` with QuantOS-owned Data Contract fields covering source, license, schema, lineage, and hash metadata;
- enforcement that data queries remain research or evaluation only and never enter trading workflows;
- production gate that rejects OpenBB enablement until legal approval exists;
- Python and Rust contract harness coverage, including 100 fixed-input replay validation and stream-cancel timing checks.

## Acceptance evidence

- `engines/tests/test_openbb_adapter_contract.py`
- `crates/quantos-engine-manager/tests/python_openbb_adapter.rs`
- `docs/adr/20260731-tp05-openbb-license-gate.md`
- `engines/openbb-adapter/src/openbb_adapter/*`

## Notes

- TP05 now satisfies the repository-side implementation for the plan item at `docs/SumAlpha-QuantOS-Development-Plan.md#L147`.
- OpenBB remains evaluation-only by default. Production enablement still requires explicit legal approval and synchronized gate, NOTICE, and release-manifest updates.
