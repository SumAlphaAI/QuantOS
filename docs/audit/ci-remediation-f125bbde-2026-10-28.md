# f125bbde CI 跟踪与修复（2026-10-28）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。远端基线为 `f125bbdeed4f0a4ddab6313d61f868e9823db0c0`，修复在 main 本地提交，不推送。新提交的 hosted CI、目标数据库、部署与发布验收仍为 NOT_RUN。

## 远端结果及原因

同 SHA 的8个 push 工作流均已结束：5成功、3失败。Frontend Baseline、F03、F09、R01、Compatibility 成功；另有 uv dependency graph 动态任务成功。查询时没有该 SHA 的 schedule 或 F05/F07 运行。

三个失败均来自 `engines/tests/test_tp08_qlib_mapping_samples.py::test_cli_generated_samples_match_tracked_bytes`：

- [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40600529549)：Test workspace 中 Python 1927 PASS、1 FAIL；verify-download 传播上游失败，保留该行为。
- [F08 Engine CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40600529543)：同一测试失败；Python 覆盖率90.77%已达85%，失败原因不是门槛。
- [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/40600529545)：clean-room 的同一 Python 测试失败；reproducibility job 成功。

上轮 msgpack 安全升级更新了 `engines/uv.lock`，但遗漏同步 TP08 当前可重现样本。生成器将完整锁文件摘要纳入研究产物的 environment_hash，因此新锁产生的新字节与旧样本不一致。本地在修改前复现相同失败：40 PASS、1 FAIL。主 CI 此次未抵达后续 SCA/覆盖率/打包步骤，不把这些跳过项记为通过。

## 修复及范围

使用原 `third_party/qlib/experiments.py` 在独立 artifact 目录生成，再比较并复制当前样本。仅改变 `mappings/02-lightgbm-experiment-to-research-artifact.json` 的 environment_hash、外层 content_hash，以及 `mappings/receipt.json` 对应文件的摘要。其余5份产物逐字节不变，包括三个对象的内容。README 补充本次同步及锁更新前复验步骤。

生成器、字节比对测试、拒绝检查、依赖锁、工作流、覆盖率门槛、扫描器及豁免均未改变。上游 Qlib pin 和固定 synthetic 输入日期保持原含义；formalAccepted=false、reference_only、未执行上游 runtime / 数据库的限制保留。当前示例维护不更新历史验收证据或正式准入。

## 验证

| 命令/检查 | 结果 |
|---|---|
| 修改前 uv locked TP08 Python 测试 | 原失败保留；40 PASS、1 FAIL |
| `QUANTOS_SKIP_ENV=1 make test-python` | 1928 PASS；与 main / F01 失败点相同入口 |
| F08 原 Python pytest 覆盖率命令（仅输出路径改为本轮 artifacts） | 1928 PASS，90.77%，保持85%门槛 |
| `node scripts/check-f08-python-coverage.mjs` | PASS；原文件级覆盖率检查 |
| TP08 Node 校验及拒绝测试、F05/F07 手工策略测试 | 合计36 PASS、0 skip（TP08 30、手工策略6） |
| `node scripts/tp08-evaluation.mjs third_party/qlib/mappings` | PASS；三份映射、三个对象，formalAccepted=false |
| 逐文件及 JSON 字段差异断言 | PASS；只变化上述环境封装及 receipt 摘要 |
| `git diff --check`、原始证据凭据扫描 | PASS；未新增豁免 |

本轮只修改离线样本和说明，复验三个失败工作流共用的 Python 路径及直接消费者。完整 F01 clean-room/三次构建、完整 F08 Rust Gate、其他无关全仓检查未重跑，保留 NOT_RUN；新提交在用户推送后由同 SHA CI 复验。

F05/F07 工作流仍仅 workflow_dispatch，确认输入默认 false，job 同时要求显式确认及 `QUANTOS_MANUAL_F05_F07=1`。本轮没有执行全量数据库 campaign、读取 .env.local、连接数据库、修改 secrets 或推送。实际 F08 Python 覆盖率是独立的离线检查，不属于 F05/F07 数据库 campaign。

## 证据

[本轮证据](evidence/ci-f125bbde-20261028) 保留三个原始失败日志、同 SHA 工作流/任务终态、修改前后测试输出、样本差异、覆盖率和源码绑定。gzip 归档可无损解压，SHA256SUMS 绑定归档字节；历史失败不覆盖或改写。
