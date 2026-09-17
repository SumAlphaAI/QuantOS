# ADR: F01 Rust workspace test runner

Date: 2026-09-17. Status: adopted for the F01 remediation.

F01-A09 identified that the plan prescribed nextest while every existing local
and CI entrypoint used Cargo's built-in test runner. For this baseline we retain
`cargo test --workspace --locked`, with the pinned Rust 1.91.0 toolchain, as the
required runner. It executes unit/integration tests and doctests and preserves
the current UDS Python contract harness. Clippy and formatting remain separate
mandatory checks. No test cases or thresholds are removed by this decision.

A separate nextest installation is not required for F01. If future CI adopts it
for sharding, it must pin the version, demonstrate equivalent test discovery,
and retain a separate doctest invocation. This decision changes the general
plan's runner wording; it does not waive coverage, negative tests or live-target
receipts, and does not claim nextest was executed.
