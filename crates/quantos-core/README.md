# quantos-core

`quantos-core` owns the validated primitives shared by QuantOS Rust services.

## Public contracts

- Typed UUID wrappers generate UUIDv7 values and prevent accidental mixing at Rust compile time.
- `SystemUtcClock`, `FixedUtcClock`, and `parse_utc_rfc3339` keep domain time in UTC.
- `CoreError` maps every failure to a stable `CORE_*` machine code.
- `Money` accepts three-letter uppercase currency codes and at most nine decimal places.
- `Quantity` is non-negative and accepts at most twelve decimal places.
- `SchemaVersion`, `BuildVersion`, and `ContentHash` validate their wire representation during construction and deserialization.
- `FixtureBuilder` produces canonical, recursively key-sorted JSON and binds it to a SHA-256 content hash. Deserialized fixtures recompute and verify that hash before they are accepted.

Fields that carry invariants are private. Use constructors and read-only accessors; do not introduce alternate deserialization paths that bypass validation.

## Test assets and Gates

`quantos-testkit` supplies fixed clocks, deterministic ID sequences, the 1,000-fixture corpus, and the domain-operation P95 check. Run the complete local F04 Gate with:

```sh
make f04-check
```

Stable CI enforces independent `quantos-core` line and region coverage. The `F04 Core Branch Coverage` workflow uses nightly LLVM branch instrumentation and requires at least 90% branch coverage. `make coverage-rust` also retains the repository-wide core/risk/execution coverage check.

Canonical JSON is defined for `serde_json::Value` and is intended for QuantOS-owned fixture and content-addressing contracts. A `FixtureId` is intentionally excluded from the hash document so independently built fixtures with the same kind, schema, and fields have the same content hash.
