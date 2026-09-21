# quantos-testkit

Reusable test support for quantos-core: fixed UTC clocks, deterministic typed ID sequences, a 1,000-fixture canonical hash corpus, and domain-operation P95 measurements. The `fixture-corpus` binary emits test measurements and participates in build reproducibility, but is excluded from runtime release binaries. This library has no service entrypoint and does not access production data or credentials. Run `cargo test -p quantos-testkit --locked` or `make f04-check`; timing measurements are local evidence, not production latency acceptance.
