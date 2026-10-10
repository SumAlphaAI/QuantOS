# TP08 Qlib 开发验收 — 2026-10-10

**TP08 DEVELOPMENT READY**。冻结源码 `5c084c5e0d39d88dea2844980cebfafa085ad47a` 的必要 13 节点、53 唯一命令组实际通过，递归内容绑定校验通过。当前 13 READY、146 NOT_ASSESSED、0 BLOCKED；formalAccepted=false。结论 **reference_only**，不建立 Qlib adapter，不引入第二 Quant Core。不授予 R1 整体、正式 ACCEPTED、法律/数据用途、upstream 运行时、hosted CI 或发布权限。

## 实现与边界

固定 `microsoft/qlib@d5379c520f66a39953bad76234a7019a72796fd0` 的六份上游文件已静态重取，原文、URL、字节摘要及 MIT notices 保留。SPDX 改为项目及六文件的 descriptor-only 记录；Git SHA-1 不再伪标为 SHA-256。23 条直接依赖声明与固定 pyproject 原文逐条核对，未安装、未解析完整图。当前 advisory scan NOT RUN，CVE 为 NOT_ASSESSED_RESOLVED_GRAPH，runtimeAdmission=DENIED。历史 ensurepip 失败不作为当前宿主机结果。

三项 QuantOS 自有离线实验均使用 synthetic-test-only 数据：mean5/return1 两项参考特征的 24 行结果映射至实际 typed DataSnapshot；零收益基线的 21 样本配置/指标映射至实际 typed ResearchArtifact，MAE=0.02485689；双次相同输入的本地重放验证字节一致与三个 scoped mock 对象去重。当前生成的 protobuf 与 JSON Schema 独立校验，真实对象字节、输入/输出/自身代码摘要、来源及 tenant/workspace/actor 引用闭合。首项特征无标签，未来行修改不能改变既往特征值。

历史文件名中的 Alpha158、LightGBM、Runtime 仅指设计来源；完整 Alpha158、模型训练、Qlib、MLflow、实际 Runtime、真实市场数据、数据库及持久存储均未在这些实验中执行。mock URI 有本地实际字节，但无上传；in-memory scope 拒绝不等于部署认证。软件 MIT 权利不授予市场数据用途。生产构建/manifest 使用排除 Gate，拒绝 Qlib 路径和 runtime lock 项；这是 TP08 排除证明，非发布批准。

## 实际验证与证据

```sh
engines/.venv/bin/python third_party/qlib/experiments.py --output artifacts/tp08-development
engines/.venv/bin/python -m pytest engines/tests/test_tp08_qlib_mapping_samples.py -vv
node scripts/tp08-evaluation.mjs artifacts/tp08-development
node --test scripts/tp08-evaluation.test.mjs
node third_party/qlib/check-development.mjs --record
node scripts/provider-a1-receipts.mjs --assess-tp08 docs/audit/evidence/provider-a1-remediation-20261004/tp08-admission-20261010/attempt-02
node third_party/qlib/check-development.mjs --admit
node third_party/qlib/check-development.mjs --ready
make lint
make test
node docs/audit/evidence/tp08-20261010/final-checks.mjs
node docs/audit/evidence/tp08-20261010/final-gate-probes.mjs
python3 docs/audit/evidence/tp08-20261010/independent-oracle.py
python3 docs/audit/evidence/tp08-20261010/git-evidence-tracking.py --check-commit
```

[53 组执行台账](./evidence/provider-a1-remediation-20261004/tp08-admission-20261010/attempt-02/execution-results.json)、[TP08 manifest](./evidence/provider-a1-remediation-20261004/tp08-admission-20261010/attempt-02/core-tp08.json)、[F05](./evidence/provider-a1-remediation-20261004/tp08-admission-20261010/attempt-02/core-f05.json)、[F08](./evidence/provider-a1-remediation-20261004/tp08-admission-20261010/attempt-02/core-f08.json)、[F0](./evidence/provider-a1-remediation-20261004/tp08-admission-20261010/attempt-02/core-gate-f0.json)绑定当前功能输入、冻结源码、实际命令、日志、输出和递归依赖。严格节点为 F01/F03/F04/F05/F02/F06/F07/F08/F09、TP01-A/B、F0、TP08；TP02/TP03/TP04/TP05、TP01-C/D、R01/R02 本轮未重授准入，历史记录保留。

[组件 9 组](./evidence/tp08-20261010/receipt.json)通过：Python 映射 40、来源/schema/生产排除 30、实验执行、独立 schema、Ruff、两文件 format、Pyright、locks、intake（来源 30 项为一组，组件共 9 组）。[全量 make test](./evidence/tp08-20261010/full-test-summary.json)：Rust333、Python1287、Web229。默认 Rust 两项 ignored、无 DB 配置提前返回和 Web 三项默认 UDS bridge skip 不作为目标或部署验收。全仓 lint 通过；聚焦回执 176/176（含 TP08 15）、TP08/TP05 生产/来源 38/38、计划负向 38/38、P0 策略 16/16、[严格 Gate 破坏探针 9/9](./evidence/tp08-20261010/final-gate-probes.json)及[最终 11 组检查](./evidence/tp08-20261010/final-checks.json)通过。[独立 Fraction 指标复算](./evidence/tp08-20261010/independent-oracle.json)使用精确有理数，确认 21 样本 MAE 的八位值。

本轮依赖中的数据库结论来自已配置开发 Supabase 目标：F02/F05 DB、Storage、RLS；F06 Auth/BFF/Runtime、执行权限/Vault/数据库；F07 恢复；F08 实际服务；F09 cron/故障/容量/trace。清理回执保留；未创建本地 PostgreSQL/Supabase、容器或临时数据库。

F05 event/receipt/派发/唯一副作用各 10,000，checkpoint=10001；消费 760234.00ms，event-ID-client-retrieval 诊断 33412.00ms，不代表完整 payload 或代表性 P95。F07 恢复 100 项，唯一 Artifact 100；调度 P95 诊断 1124.29ms，目标 200ms。正确性 PASS 不授予性能 PASS。

## 初始问题与修复

旧占位映射、字段存在性测试和错误 SHA-256 SBOM 已替换，原件保留。首轮指标预期手算错误与两处 Decimal 类型推导错误，分别经独立有理数复算及显式 Decimal 求和修复：[指标失败](./evidence/tp08-20261010/initial/metric-oracle-failure.log)、[Pyright 失败](./evidence/tp08-20261010/initial/pyright-first.log)。uv 缓存沙箱读取失败经授权环境重跑通过，未改锁或安装 Qlib。

全仓 Ruff 补查发现保存的上游原文 15 项既有风格问题。保持原文摘要，按既有第三方参考代码惯例从全仓 Ruff 排除只读原文目录；自有实验代码继续受检。首个源码轮次 F01/F06 通过后中断，F09 内建取消、fixture 清理 PASS，未发布 READY：[中断记录](./evidence/tp08-20261010/initial/interrupted-admission-01/interruption.json)、[清理原件](./evidence/tp08-20261010/initial/interrupted-admission-01/f09-cancelled.json)。修复后全仓 lint 和组件通过，再冻结 5c084c5e 并完整重跑本轮 53 组；旧结果不转授。

## 未决风险、Git 与下一任务

当前未验：完整上游解析依赖/SBOM/CVE、上游运行时、真实数据许可、完整因子/模型能力、持久 Artifact/audit、部署 Runtime/认证、OS 出站隔离、代表性性能/长稳、hosted CI、正式 ACCEPTED 和发布。F05/F07 性能风险仍保留。无生产凭据或外部发布动作；未推送。

主要变更为 [实验代码](../../third_party/qlib/experiments.py)、[映射测试](../../engines/tests/test_tp08_qlib_mapping_samples.py)、[来源/独立 schema/生产排除](../../scripts/tp08-evaluation.mjs)、[组件回执](../../third_party/qlib/check-development.mjs)、统一回执策略/构建入口、固定来源/真实对象/许可证与 CVE 记录、ADR/能力矩阵/进度及双计划。完整清单见 [changed-files.txt](./evidence/tp08-20261010/changed-files.txt)。[Git 引用字节校验](./evidence/tp08-20261010/git-evidence-tracking.json)与[报告链接校验](./evidence/tp08-20261010/report-links.json)保留。源码实现提交 232a9309，lint 范围修复/冻结提交 5c084c5e，最终文档与证据提交见 Git 历史；提交后再验 Git 中保存的实际证据字节。

下一可执行任务：**TP10 ValueCell** 限定信息架构评估（仅依赖 F0，当前严格 READY）。若按编号执行 TP09 TrendRadar，须先刷新 TP03 自身当前准入。R03 的 R02/TP02 当前准入仍需独立刷新。
