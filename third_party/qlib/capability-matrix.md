# TP08 Qlib Capability Matrix

Baseline: `microsoft/qlib@d5379c520f66a39953bad76234a7019a72796fd0` (`v0.9.7-31-gd5379c52`, MIT).

Scope of evaluation per the development plan: dataset handling, factor experimentation, and workflow reproducibility. Qlib must not become a second Quant Core.

## Legend

- `reference`: worth absorbing as design/test reference only
- `gap`: capability exists upstream but conflicts with QuantOS contracts or boundaries
- `reject`: must not enter QuantOS in any form
- `owned`: QuantOS already owns an equivalent; upstream adds no leverage

## 1. Dataset capabilities

| Qlib capability | Upstream surface | QuantOS fit | Verdict |
| --- | --- | --- | --- |
| Expression engine for factors (`qlib/data/ops.py`, e.g. `Ref`, `Mean`, `Std`, `Corr`) | declarative factor algebra over market data | mirrors TP03 feature/factor needs; good design reference for a versioned factor DSL | reference |
| Dataset handler pattern (`Alpha158` / `Alpha360` handlers) | declarative feature-set + label-set definitions over a universe and calendar | maps cleanly onto `DataSnapshot` + feature snapshot semantics; see mapping sample 01 | reference |
| Universe + calendar handling (instruments, trading calendar) | CSI300/CSI500 style universes with time slices | QuantOS `symbols` + `TimeWindow` already cover this | owned |
| Binary data storage + local cache (`dump_bin`, file cache, expression cache) | local file/binary store | conflicts with F05 snapshot catalog, storage backend, and lineage/hash contracts | reject |
| Client-server data infra (`redis`, `pymongo`, socketio client) | remote data service | bypasses QuantOS provider, license gate, and lineage | reject |
| Community data feed (`get_data.py` crowd-sourced dumps) | downloaded Yahoo-style dumps | no license/provenance labels per source; cannot satisfy `sources`/`license_label` | reject |
| PIT (point-in-time) data support (`qlib/data/pit.py`) | period-based fundamentals | useful design reference for future PIT snapshots | reference |

## 2. Factor experiment capabilities

| Qlib capability | Upstream surface | QuantOS fit | Verdict |
| --- | --- | --- | --- |
| Declarative experiment config (`qrun` YAML: handler + model + dataset + record) | single-file experiment description | strong reference for versioned experiment definitions; see mapping sample 02 | reference |
| Benchmark model zoo (`examples/benchmarks`: LightGBM, XGBoost, LSTM, TFT, TRA, GATs, HIST, ~25 models) | reference factor models | useful as factor/research inspiration inside TP03 fixtures, not as runtime models | reference |
| Rolling / nested retraining (`examples/model_rolling`, `benchmarks_dynamic`) | rolling experiment orchestration | reference for research-loop design in R1/R03 | reference |
| Model training runtime (`qlib/model`, torch/lgbm trainers) | in-process training | conflicts with F08 engine boundary and TP03 sidecar ownership | reject |
| Hyperparameter tuning (`examples/hyperparameter`) | tuning loops | reference only | reference |

## 3. Workflow reproducibility capabilities

| Qlib capability | Upstream surface | QuantOS fit | Verdict |
| --- | --- | --- | --- |
| Experiment/recorder model (`qlib/workflow`: `R`, `ExperimentManager`, `Recorder`) | experiment -> recorder -> metrics/params/artifacts | conceptually aligns with QuantOS run + artifact records; see mapping sample 03 | reference |
| MLflow-backed tracking (`mlflow` dependency) | external tracking server | conflicts with QuantOS artifact store, hash dedup, and tenant isolation | reject |
| Task management (`qlib/workflow/task`) | task generation and rerun | reference for orchestration semantics | reference |
| Config snapshot via `qrun` YAML + code version | rerunnable experiment definition | QuantOS already enforces input hash + versioned engines; upstream mechanism adds no guarantee | owned |

## 4. Out-of-scope surfaces (explicitly rejected)

| Surface | Reason |
| --- | --- |
| `qlib/backtest`, `qlib/strategy` | execution-adjacent; QuantOS decision chain is TP03/TP04 with `executable=false`; backtest belongs to future controlled simulation, not this evaluation |
| `qlib/rl` | RL training + gym dependency; outside TP08 scope and heavy supply-chain cost |
| Online serving (`qlib/workflow/online`) | production serving path; violates engine isolation |
| `gym`, `jupyter`, `matplotlib`, `nbconvert` dependencies | notebook/UI/RL dependencies inflate SBOM and CVE surface for zero contract value |

## 5. Summary

Qlib's value to QuantOS is concentrated in three design assets: the expression/handler dataset model, the declarative experiment config, and the experiment-recorder reproducibility model. All three are absorbed as reference and mapping samples only. Every surface that would turn Qlib into a runtime dependency (data infra, tracking server, training runtime, backtest/execution) is rejected.

Conclusion: `reference_only`. No adapter is justified at this time; see the TP08 ADR for the decision and replacement cost.
