# mock-engine

Deterministic Python engine used by F08 contract tests.

It serves the QuantOS Engine gRPC contract over a Unix domain socket and supports:

- `GetMetadata`
- `Health`
- `Execute`
- `StreamExecute`
- `Cancel`
