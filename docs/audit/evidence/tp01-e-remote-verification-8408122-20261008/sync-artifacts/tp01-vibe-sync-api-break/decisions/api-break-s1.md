# TP01 Sync Decision: adapter API compatibility break

- Severity: `S1`
- Candidate ref: `v0.1.13@deadbeef0001`
- Baseline: `v0.1.13` @ `c33133f4fd5e978d21d2a61fdd8787fb352b4687`
- Blocked: `true`

## Reasons

- candidate indicates adapter API / contract breakage

## Diff Summary

- api: 1
- state: 1
- ux: 1

## Range-Diff Summary

- no patch-queue overlap detected

## Required Actions

- run adapter contract, replay, and negative-permission regression suites
- review LICENSE / NOTICE / dependency diffs before any merge
- prepare a versioned translator or keep the candidate isolated

## Gate Result

- Result: blocked pending the required actions and quality gate evidence.

