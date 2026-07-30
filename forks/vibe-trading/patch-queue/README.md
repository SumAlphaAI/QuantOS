# TP01 Minimal Patch Queue

This directory records the approved conceptual patch queue for TP01-D.

The current queue is intentionally minimal: it documents which upstream design ideas are admitted into `engines/vibe-adapter` and which ones remain rejected.

## Current queue

1. `0001-research-workflow-shape.md`
2. `0002-streaming-phase-projection.md`

## Rules

- queue entries describe approved design absorption, not direct runtime reuse;
- every queue entry must reference the locked upstream SHA and the QuantOS adapter module that absorbs the design;
- any entry that would reintroduce upstream session, memory, auth, audit, broker, or shell semantics must be rejected.
