# quantos-policy

Pure, deterministic authorization rules over tenant/actor/workspace/account,
role, capability and run mode. Inputs are `PolicyContext` and authorization or
secret-access requirements; outputs are an allow result or typed `PolicyError`.

Depends on core identity types and serialization only. No database, network,
venue, Python or frontend dependency belongs here. Identity loading and secret
retrieval are responsibilities of `quantos-auth` and the execution boundary.

Run `cargo test -p quantos-policy`; rejection paths must remain default-deny.
