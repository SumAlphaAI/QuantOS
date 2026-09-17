# bff-gateway

HTTP boundary serving QuantOS-owned page contracts from `bff/openapi/`.
The router accepts typed requests and returns authorized page data or stable
errors. Session/capability context must be verified before selecting tenant data.

The service may compose domain providers; it must not let browsers read venue
credentials, bypass command approval or invoke Python packages directly.
Current local/provider tests do not establish production identity or database
composition. Consult the BFF-FE acceptance records before deployment.

Run `cargo test -p bff-gateway` and `make bff-contract-check`. The executable
entrypoint is `cargo run -p bff-gateway`; bind/configuration details live in
`src/main.rs`. Never supply production credentials for local verification.
