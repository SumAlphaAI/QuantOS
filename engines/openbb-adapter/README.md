# openbb-adapter

Controlled TP05 data and research query adapter for QuantOS.

Current scope:

- QuantOS-native engine manifest exposing `data.query.v1`
- deterministic fixture-backed Data Contract output with source, license, schema, lineage, and hash metadata
- adapter-local boundary validation for trading workflows, venue access, secrets, arbitrary networking, and non-allowlisted tools
- provider abstraction with isolated OpenBB evaluation provider and mock replacement provider
- license gate that blocks production enablement until legal approval exists
- UDS gRPC service implementing all five Engine RPCs
