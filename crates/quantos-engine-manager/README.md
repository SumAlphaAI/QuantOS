# quantos-engine-manager

Manifest review, UDS gRPC routing, crash backoff, deadline enforcement, and contract tests for QuantOS engines.

## Current scope

- review and register Engine manifests
- route requests by capability
- connect to Python engines over Unix domain sockets with tonic
- apply backoff after repeated `UNAVAILABLE` failures
- return deterministic deadline errors
- exercise the Python `mock-engine` in cross-language tests
