# trading-agents

Controlled TP04 multi-agent decision engine for QuantOS.

Current scope:

- QuantOS-native engine manifest exposing `decision.proposal.v1`
- deterministic fixture-backed `TradeProposal` output with committee debate and policy artifacts
- adapter-local boundary validation for order, venue, secret, and arbitrary network or tool requests
- UDS gRPC service implementing all five Engine RPCs
- fixed-input replay harness covering 100 deterministic proposal requests
- stream cancellation checks that take effect within the TP04 2-second bound
