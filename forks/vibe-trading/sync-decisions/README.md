# TP01 Sync Decisions

This directory stores curated decision records for accepted or blocked TP01 sync candidates.

Runtime automation writes working artifacts under `artifacts/third_party/vibe-trading/sync-vibe/`. When a candidate requires a durable repository record, copy the generated decision into this directory and add the final disposition.

## Required fields

- candidate ref and baseline ref
- severity (`S0`-`S3`)
- diff summary and range-diff overlap summary
- blocking conditions
- final disposition and rollback pointer when applicable
