# 0001 Research Workflow Shape

- Upstream baseline: `HKUDS/Vibe-Trading@c33133f4fd5e978d21d2a61fdd8787fb352b4687`
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

## 2026-10-09 engineering validation

The v0.1.12 origin remains historical provenance in queue.json. The already controlled v0.1.13 reference is bound by SHA and source-file digest; this queue applies no upstream code, fork patch, auth/session storage, or publication. QuantOS context, allowlist, audit and Artifact facades replace those calls.
