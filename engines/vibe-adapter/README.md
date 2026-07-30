# vibe-adapter

Controlled TP01 adapter skeleton for `HKUDS/Vibe-Trading`.

Current scope:

- QuantOS-native engine manifest for `vibe-adapter`
- UDS gRPC server implementing all five Engine RPCs
- context translator from `ExecuteRequest` to adapter-local execution context
- QuantOS-native `ResearchExecutionContract` / `ResearchContractProvider` boundary for replaceable research providers
- selective absorption modules for workflow planning, streaming projection, and audit wrapping
- research-safe tool allowlist
- deterministic Artifact API facade that emits QuantOS artifact/evidence refs only
- 20 replay-oriented research fixtures admitted through a catalog

Hard boundaries:

- no venue or broker connectivity
- no secret resolution
- no shell or arbitrary file mutation tools
- no upstream session or persistent memory store reuse
