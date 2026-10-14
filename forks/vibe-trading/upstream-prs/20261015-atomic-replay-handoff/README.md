# Review patch: atomic replay-to-live subscription handoff

Status: **DRAFT_NOT_SUBMITTED**. PR URL: none. No remote branch, push, issue, PR,
release or production action has been performed. This is checked only against
Vibe-Trading commit `c33133f4fd5e978d21d2a61fdd8787fb352b4687`, not current upstream HEAD.

`EventBus.subscribe` registers a live queue, releases the lock, then snapshots
replay. A publish in that gap enters both the buffer and the queue. Reconnecting
clients can receive the same event twice. The patch snapshots replay and registers
the live queue within the same lock. It extracts a private locked replay helper;
public cursor, missing-cursor and first-connect behavior stay the same.

Four standard-library unittest cases include a deterministic lock-release hook
that publishes in the old gap. On the unchanged baseline the reconnect and replay-all
cases fail (two expected failures); the same four cases pass after applying the
patch. No timer-based race or external service is needed. The stream queue/buffer
capacity, cross-thread enqueue ordering, session clear race and shutdown semantics
are outside this patch and require separate upstream review.

Review with:

```sh
python3 scripts/tp01-g-upstream-patch.py --output-dir /tmp/quantos-tp01-g-patch-review
```

The checker uses local pinned Git bytes, `git apply --check` and an isolated temporary
copy. It never modifies the checkout/submodule. Manifest SHA-256 values bind source
and patch bytes. The patch includes only generic upstream code and its unittest;
QuantOS modules, tenant policy, credentials and production config are excluded.
Upstream submission, rebasing onto a newer baseline and acceptance need a separate
authorized task. Upstream acceptance is not required for this local development Gate.
