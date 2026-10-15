# TP01-F Vibe Canary Summary

Synthetic policy simulation; target canary acceptance and release approval remain NOT_RUN.

- scenario: `alert-breach`
- outcome: `disabled`
- blocked: `true`
- capability flag: `research.vibe_adapter.canary` -> `disabled`
- rollout percent: `0%`
- canary days observed: `2`
- shadow tasks completed: `36`

## Reasons

- unexplained P1 detected during canary
- execute P95 exceeded canary threshold
- cancel confirmation exceeded deterministic threshold
- canary error rate exceeded threshold
- shadow mismatch rate exceeded threshold
- unauthorized egress detected
- secret or venue violation detected
- required signed artifacts are missing
- audit evidence is incomplete
- rollback drill exceeded the five-minute SLA
- canary window is 2 day(s); 7 day(s) are required before default enablement

## Alerts

- tp01_vibe_unexplained_p1: unexplained P1 detected during canary (observed=1, threshold=0)
- tp01_vibe_execute_p95_ms: execute P95 exceeded canary threshold (observed=1630, threshold=1000)
- tp01_vibe_cancel_confirmation_secs: cancel confirmation exceeded deterministic threshold (observed=3.5, threshold=2)
- tp01_vibe_error_rate: canary error rate exceeded threshold (observed=0.08, threshold=0.01)
- tp01_vibe_shadow_mismatch_rate: shadow mismatch rate exceeded threshold (observed=0.06, threshold=0.02)
- tp01_vibe_unauthorized_egress_total: unauthorized egress detected (observed=1, threshold=0)
- tp01_vibe_secret_or_venue_violation_total: secret or venue violation detected (observed=1, threshold=0)
- tp01_vibe_unsigned_release_artifacts: required signed artifacts are missing (observed=false, threshold=true)
- tp01_vibe_audit_incomplete: audit evidence is incomplete (observed=false, threshold=true)
- tp01_vibe_rollback_duration_secs: rollback drill exceeded the five-minute SLA (observed=420, threshold=300)

