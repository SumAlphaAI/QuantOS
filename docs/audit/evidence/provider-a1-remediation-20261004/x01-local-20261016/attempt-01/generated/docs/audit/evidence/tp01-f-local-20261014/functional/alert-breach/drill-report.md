# TP01-F Vibe Canary Drill Report

Synthetic durations and signedArtifactsPresent are fixture assertions; no actual signature or target SLA acceptance is implied.

- scenario: `alert-breach`
- operation: `canary`
- outcome: `disabled`
- rollback completed in: `420.0s`
- audit complete: `false`
- signed artifacts present: `false`
- runtime isolation verified: `true`

## Canary Metrics

- error rate: 8.00%
- execute P95: 1630ms
- cancel confirmation: 3.5s
- shadow mismatch rate: 6.00%

## Actions

- capability flag moved to `disabled`
- candidate release remains isolated pending remediation

