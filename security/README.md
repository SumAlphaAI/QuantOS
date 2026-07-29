# security

Security policy inputs for CI live here.

- `node-license-allowlist.json`: allowed SPDX identifiers for npm dependencies.
- `sca-waivers.json`: vulnerability waiver ledger with required expiry dates.

CI validates the waiver file schema and expiry before any scan is allowed to pass.
