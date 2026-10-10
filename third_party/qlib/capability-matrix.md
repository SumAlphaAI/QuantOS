# TP08 Qlib capability matrix — 2026-10-10

Pinned `microsoft/qlib@d5379c520f66a39953bad76234a7019a72796fd0`; MIT source notices retained. Evidence scope is the six files listed in `upstream-evidence/provenance.json`, not an exhaustive runtime audit.

| Capability / reviewed surface | QuantOS mapping / experiment | Disposition and limit |
| --- | --- | --- |
| Alpha158 handler declaration (`qlib/contrib/data/handler.py`) | Own synthetic mean5/return1 subset → typed DataSnapshot, 24 rows | Reference only; full Alpha158 and upstream data backend not executed |
| Declarative dataset/model/record configuration (pinned LightGBM YAML) | Own zero-return baseline/config/metrics → typed ResearchArtifact, 21 labels | Reference only; no LightGBM training, model equivalence or predictive claim |
| Recorder artifact/config/metric interfaces (`qlib/workflow/recorder.py`) | Double local replay with immutable scope-aware objects and byte hashes | Reference only; no MLflow, persistent store, deployed Runtime or actual upstream workflow |
| Runtime requirements (pyproject/setup descriptor) | 23 declared dependency strings, six-file SPDX evidence | No installation; unresolved graph and advisory clearance remain NOT_ASSESSED |
| Separate data store, training, recorder, execution authority | Existing F05, owned research engines and orchestration own these responsibilities | Reject runtime adoption in this task; no second Quant Core |

The three experiments demonstrate representability of these small design patterns in current QuantOS contracts. They do not demonstrate complete upstream behavioral equivalence. Dataset software rights and source data rights remain separate. Replacement cost and reconsideration requirements are in `docs/adr/20260731-tp08-qlib-evaluation.md`.
