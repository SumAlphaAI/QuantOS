# quantos-engine-manager

Reviewed manifest admission, supervised UDS sidecars, routing, quotas, deadlines, recovery, and contract tests for QuantOS engines.

## Current scope

- verify signed approval, artifact digest, and live Engine identity
- start, monitor, restart, and stop local sidecars
- enforce signed routing policy, rate/concurrency/resource limits, deadlines, and cancellation ownership
- persist reviewed sidecar circuit state and idempotency results across Manager processes; serialize each request key with an OS file lock
- exercise all Python Engines through a common contract harness

Deployment and rollback steps: [F08 runbook](../../docs/runbooks/f08-engine-manager.md).
