# TP01 Vibe Adapter Canary Rollback

This runbook covers the TP01 `vibe-adapter` canary and rollback flow after the adapter has passed contract, replay, and negative-permission gates.

## Core rules

1. `research.vibe_adapter.canary` is the only rollout switch. Never enable the adapter by code deploy alone.
2. Every candidate release must have a signed `release-manifest.json` and signed drill evidence before it can leave the disabled state.
3. Any unexplained `P1`, unauthorized egress, secret access, or venue-touch signal requires immediate disable or rollback.
4. Removing or disabling the adapter must not stop other QuantOS Runtime workflows from booting or routing.

## Canary activation flow

1. Generate the candidate evidence bundle with `tp01-vibe-canary.mjs`, including `canary-summary.json`, `release-manifest.json`, `rollout-state.json`, and `drill-report.md`.
2. Sign `release-manifest.json` and `drill-report.md` with `scripts/sign-artifacts.sh`.
3. Set the capability flag to `canary` at 5% traffic with shadow mode enabled.
4. Confirm dashboards in `docs/operations/tp01_vibe_canary_dashboards.json` and alert rules in `docs/operations/tp01_vibe_canary_alert_rules.yaml` are active.
5. Observe the canary window until either:
   - 7 days complete with no unexplained `P1`, or
   - any critical alert forces disable / rollback.

## One-click disable

Use the rollback action script with `--action disable` when the candidate must stop receiving traffic immediately but the previous artifact does not need to be restored yet.

```bash
node ./scripts/tp01-vibe-rollback.mjs \
  --state ./artifacts/third_party/vibe-trading/canary/current/rollout-state.json \
  --action disable \
  --reason "critical canary alert" \
  --output-state ./artifacts/third_party/vibe-trading/canary/current/rollout-state.json \
  --output-report ./artifacts/third_party/vibe-trading/canary/current/rollback-action.md
```

## One-click rollback

Use the rollback action script with `--action rollback` when the previous approved release must become active again.

```bash
node ./scripts/tp01-vibe-rollback.mjs \
  --state ./artifacts/third_party/vibe-trading/canary/current/rollout-state.json \
  --action rollback \
  --reason "restore previous approved release" \
  --output-state ./artifacts/third_party/vibe-trading/canary/current/rollout-state.json \
  --output-report ./artifacts/third_party/vibe-trading/canary/current/rollback-action.md
```

## Verification checklist

1. The capability flag reports `disabled` or `rolled_back`.
2. The active release digest matches the previous approved artifact when rollback is requested.
3. `tp01_vibe_rollback_duration_secs` stays at or below 300 seconds.
4. Audit evidence is complete and signed.
5. Mock-engine and non-TP01 workflows continue routing normally.
