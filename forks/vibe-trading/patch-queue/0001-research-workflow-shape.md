# 0001 Research Workflow Shape

- Upstream baseline: `HKUDS/Vibe-Trading@43331c3221be37c5cc1ed8dddc4c7988bcddc5cd`
- Severity: `S3`
- QuantOS target: `engines/vibe-adapter/src/vibe_adapter/workflow.py`

## Admitted design

- decompose a research request into a stable workflow plan;
- preserve replayability through fixed fixture names, snapshot references, and deterministic output fields;
- emit only QuantOS-native Artifact API output.

## Replaced upstream surfaces

- upstream session identity -> `workflow_run_id`
- upstream session config -> QuantOS `ExecuteRequest`
- upstream persistent memory references -> denied
- upstream audit/session traces -> QuantOS audit envelope

## Explicit exclusions

- no upstream session store
- no memory file reuse
- no connector or venue access
