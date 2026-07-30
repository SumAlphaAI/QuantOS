# TP01 Controlled Fork Baseline

This directory defines the governance baseline for the future controlled fork of `HKUDS/Vibe-Trading`.

## Scope

- the fork exists to absorb approved upstream deltas through a minimal patch queue;
- the fork is never a production artifact by itself;
- all runtime-facing integration must remain inside `engines/vibe-adapter`.

## Remote model

| Remote name | Purpose | URL |
| --- | --- | --- |
| `upstream` | read-only source of truth | `https://github.com/HKUDS/Vibe-Trading.git` |
| `origin` | SumAlpha-controlled fork | to be provisioned in the private repository namespace before TP01-C |

## Branch model

| Branch | Purpose |
| --- | --- |
| `sumalpha/tp01-base` | immutable branch matching the locked upstream baseline |
| `sumalpha/tp01-integration` | reviewed cherry-picks and patch queue |
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

## Evolution records

- `sync-decisions/` stores durable TP01 sync decision records.
- `upstream-prs/` stores candidate upstream contribution records for reusable bugfixes and improvements.
