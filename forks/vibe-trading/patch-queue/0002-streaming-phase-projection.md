# 0002 Streaming Phase Projection

- Upstream baseline: `HKUDS/Vibe-Trading@43331c3221be37c5cc1ed8dddc4c7988bcddc5cd`
- Severity: `S3`
- QuantOS target: `engines/vibe-adapter/src/vibe_adapter/streaming.py`

## Admitted design

- represent workflow progress as incremental phases;
- keep the final stream event responsible for the artifact attachment;
- allow replay fixtures to verify stable phase order across 20 representative workflows.

## Replaced upstream surfaces

- upstream SSE event names -> QuantOS streaming deltas
- upstream frontend store transitions -> adapter-side deterministic phase list
- upstream session event bus -> Engine `StreamExecute`

## Explicit exclusions

- no direct SSE endpoint reuse
- no upstream browser contract reuse
- no upstream event IDs or retry cursors
