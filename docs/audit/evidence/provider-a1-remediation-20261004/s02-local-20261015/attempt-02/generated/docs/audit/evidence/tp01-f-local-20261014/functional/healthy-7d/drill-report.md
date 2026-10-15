# TP01-F Vibe Canary Drill Report

Synthetic durations and signedArtifactsPresent are fixture assertions; no actual signature or target SLA acceptance is implied.

- scenario: `healthy-7d`
- operation: `canary`
- outcome: `canary_passed`
- rollback completed in: `240.0s`
- audit complete: `true`
- signed artifacts present: `true`
- runtime isolation verified: `true`

## Canary Metrics

- error rate: 0.20%
- execute P95: 420ms
- cancel confirmation: 1.4s
- shadow mismatch rate: 0.00%

## Actions

- canary remained within configured thresholds

