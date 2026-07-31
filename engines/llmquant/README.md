# llmquant

Controlled TP03 feature, factor, model, and signal engine for QuantOS.

Current scope:

- QuantOS-native engine manifest exposing `quant.signal.v1`
- deterministic fixture-backed `Signal` output with diagnostics and model provenance
- adapter-local boundary validation for OMS, venue, secrets, and arbitrary network or tool requests
- UDS gRPC service implementing all five Engine RPCs
- fixed-input replay harness covering 100 deterministic signal requests
- stream cancellation checks that take effect within the TP03 2-second bound
