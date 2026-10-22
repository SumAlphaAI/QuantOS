# First finalization failure

The original engineering candidate is 8f1f3763. All ten attempt-01 commands finished with their expected exit codes; their raw logs, inputs and artifacts remain unchanged. Final receipt verification then failed before replacing the pending receipt because reading the original design PNG with execFileSync used Node's default output buffer.

Tool output (not a separately captured original shell log):

```text
Error: spawnSync git ENOBUFS
    at Object.spawnSync (node:internal/child_process:1120:20)
    at spawnSync (node:child_process:911:24)
    at execFileSync (node:child_process:954:15)
    at verify (scripts/ui-p12-review.mjs:37:256)
    at run (scripts/ui-p12-review.mjs:47:193)
```

Correct only the verifier buffer and add an explicit same-source evidence replay. The correction commit may contain only scripts/ui-p12-review.mjs; product/test/build inputs remain bound to the original engineering SHA. Re-run only verifier/route unit checks and verifier lint, then validate the preserved ten executions and original snapshots without repeating unit functionality, build, browser or dependency chains. Do not claim the verifier-only commit as a newly tested product candidate.
