# TP01 Sync Decision: patch queue overlap with upstream workflow changes

- Severity: `S1`
- Candidate ref: `v0.1.15@deadbeef0004`
- Baseline: `v0.1.13` @ `c33133f4fd5e978d21d2a61fdd8787fb352b4687`
- Blocked: `true`

## Reasons

- patch queue overlap or merge conflict requires manual decision

## Diff Summary

- state: 1
- workflow: 1

## Range-Diff Summary

- 0001: workflow shape rewrite overlaps the approved patch queue entry

## Required Actions

- run adapter contract, replay, and negative-permission regression suites
- review LICENSE / NOTICE / dependency diffs before any merge
- inspect range-diff overlap and decide between rewrite, backport, or drop

## Gate Result

- Result: blocked pending the required actions and quality gate evidence.

