# engines

Python engine workspace and contract test harness live here.

- `engine-sdk`: shared Python manifest types, UDS gRPC server/client helpers, JSON helpers, and timestamp utilities for QuantOS engines.
- `mock-engine`: deterministic mock engine that exposes all five Engine RPCs over UDS gRPC.
- `tests/`: workspace-level contract tests that verify `GetMetadata/Health/Execute/StreamExecute/Cancel`.
