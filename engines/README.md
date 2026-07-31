# engines

Python engine workspace and contract test harness live here.

- `engine-sdk`: shared Python manifest types, UDS gRPC server/client helpers, JSON helpers, and timestamp utilities for QuantOS engines.
- `llmquant`: TP03 controlled signal engine that emits deterministic `quant.signal.v1` payloads plus model diagnostics provenance.
- `mock-engine`: deterministic mock engine that exposes all five Engine RPCs over UDS gRPC.
- `openbb-adapter`: TP05 controlled data query adapter that emits lineage-rich Data Contract responses behind a production license gate.
- `rd-agent`: TP02 controlled research engine that emits deterministic `ResearchArtifact` outputs for hypothesis and experiment capabilities.
- `trading-agents`: TP04 controlled decision engine that emits deterministic non-executable `TradeProposal` payloads plus committee and policy artifacts.
- `vibe-adapter`: TP01 controlled adapter skeleton with context translation, tool allowlist, Artifact API facade, and replay fixture.
- `tests/`: workspace-level contract tests that verify `GetMetadata/Health/Execute/StreamExecute/Cancel`.
