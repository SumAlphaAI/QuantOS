# rd-agent

Controlled TP02 research and experiment engine for QuantOS.

Current scope:

- QuantOS-native engine manifest exposing `research.hypothesis.v1` and `research.experiment.v1`
- deterministic fixture-backed `ResearchArtifact` output
- adapter-local boundary validation for secrets, trading, network, and external tool requests
- UDS gRPC service implementing all five Engine RPCs
