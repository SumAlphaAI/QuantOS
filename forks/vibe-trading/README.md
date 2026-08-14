# TP01 Controlled Fork Baseline

This directory defines the governance baseline for the SumAlpha-controlled fork of `HKUDS/Vibe-Trading`.

## Scope

- the fork exists to absorb approved upstream deltas through a minimal patch queue;
- the fork is never a production artifact by itself;
- all runtime-facing integration must remain inside `engines/vibe-adapter`.

## Remote model

| Remote name | Purpose | URL |
| --- | --- | --- |
| `upstream` | read-only source of truth | `https://github.com/HKUDS/Vibe-Trading.git` |
| `origin` | SumAlpha-controlled fork | `https://github.com/sumalphai/Vibe-Trading.git` |

## Branch model

| Branch | Purpose |
| --- | --- |
| `sumalphai/tp01-base` | immutable branch matching the locked upstream baseline |
| `sumalphai/tp01-integration` | reviewed cherry-picks and patch queue |
| `candidate/s0-*` | emergency security response candidates |
| `candidate/s1-*` | compatibility or license response candidates |
| `candidate/s2-*` | planned sync candidates |
| `candidate/s3-*` | research-only drift candidates |

## Admission rules

1. no direct push to protected branches;
2. every candidate branch needs a decision record and diff summary;
3. canary and rollback evidence remain mandatory before any adapter release consumes a fork patch;
4. removing the adapter must not prevent QuantOS Runtime from starting other workflows.

## Patch queue

The current minimal patch queue lives under `patch-queue/` and records the approved TP01-D selective absorption entries for research workflow shape and streaming phase projection.

`repository.lock.json` is the authoritative remote and branch contract. Run
`node ./scripts/bootstrap-vibe-repositories.mjs` with authenticated GitHub
access to create the ignored operational checkout, add the read-only
`upstream` remote, disable upstream push, and pin both governed branches to the
locked baseline. Run `node ./scripts/provision-vibe-github-governance.mjs` to
push missing governed branches and apply the checked-in protection policy. The
checker fails closed when remote branches or GitHub protection settings differ.

`TP01_FORK_ADMIN_TOKEN` is required only for provisioning and exact protection
verification. Use a fine-grained token restricted to this fork with
Administration read/write and Contents write; never commit the value.

## Evolution records

- `sync-decisions/` stores durable TP01 sync decision records.
- `upstream-prs/` stores candidate upstream contribution records for reusable bugfixes and improvements.
