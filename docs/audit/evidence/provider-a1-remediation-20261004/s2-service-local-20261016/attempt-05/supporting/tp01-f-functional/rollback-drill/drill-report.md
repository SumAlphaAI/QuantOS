# TP01-F Vibe Canary Drill Report

Synthetic durations and signedArtifactsPresent are fixture assertions; no actual signature or target SLA acceptance is implied.

- scenario: `rollback-drill`
- operation: `rollback_drill`
- outcome: `rolled_back`
- rollback completed in: `240.0s`
- audit complete: `true`
- signed artifacts present: `true`
- runtime isolation verified: `true`

## Canary Metrics

- error rate: 0.10%
- execute P95: 450ms
- cancel confirmation: 1.2s
- shadow mismatch rate: 0.00%

## Actions

- capability flag moved to `rolled_back`
- active release reverted to `vibe-adapter-canary-r1`

