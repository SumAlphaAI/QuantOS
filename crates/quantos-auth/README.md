# quantos-auth

Maps Supabase `auth.users` identities to tenant actors, the primary workspace,
accounts and capabilities. `PgAuthStore` loads an `AuthContext`; callers pass its
policy context to `quantos-policy`. Service secret access returns a scoped grant
only after the database allowlist/session checks.

Depends on `quantos-core`, `quantos-policy` and PostgreSQL transport. It must not
depend on UI, Python engines or venue adapters. It does not own passwords, issue
trade commands or expose decrypted secrets to ordinary users.

Run `cargo test -p quantos-auth`. PostgreSQL integration tests require an isolated
`DATABASE_URL`; a test that skips without credentials is not database acceptance.
