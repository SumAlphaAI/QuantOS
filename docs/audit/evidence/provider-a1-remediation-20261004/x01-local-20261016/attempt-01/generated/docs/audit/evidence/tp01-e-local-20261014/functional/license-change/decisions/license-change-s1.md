# TP01 Sync Decision: license or notice drift

- Severity: `S1`
- Candidate ref: `v0.1.14@deadbeef0002`
- Baseline: `v0.1.13` @ `c33133f4fd5e978d21d2a61fdd8787fb352b4687`
- Blocked: `true`

## Reasons

- LICENSE or NOTICE drift requires legal / supply-chain review
- dependency manifest drift requires compatibility review

## Diff Summary

- dependency: 1
- workflow: 2

## Range-Diff Summary

- no patch-queue overlap detected

## Required Actions

- run adapter contract, replay, and negative-permission regression suites
- review LICENSE / NOTICE / dependency diffs before any merge

## Gate Result

- Result: blocked pending the required actions and quality gate evidence.

