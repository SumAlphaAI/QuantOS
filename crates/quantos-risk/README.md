# quantos-risk

X02's `guard::RiskGuard` provides scoped Pre/Post risk evaluation and Global/Account kill-switch APIs. See [local operation and authority boundaries](../../docs/operations/x02-local-admission.md) and [ADR](../../docs/adr/20261017-x02-risk-guard.md).

Inputs are F06 authenticated context, X01 risk snapshot, S03 Release and explicit trusted daily financial/venue data. Fifteen rules produce keyed, request-bound decisions and limit IDs. Bound approval forbids self-approval. Shared clones serialize kill revisions and duplicate admission; current validation refuses stale Allows. The service is process-local and does not issue orders or claim durable/distributed recovery.

The older `RiskEngine`/`RiskDecision` is retained for compatibility fixtures. Its checksum is not a cryptographic authority signature and cannot grant X02 command permission. `PortfolioRiskInput::from_snapshot` now requires today's P&L explicitly.

Run `make x02-check`; rule-branch instrumentation is `node scripts/x02-coverage.mjs <isolated-output>/receipt.json`. `make x02-assess-local` requires a clean frozen candidate and executes all 41 nodes/135 groups. Actual deployment, persistence, source permissions, representative P95 and formal acceptance remain separate.
