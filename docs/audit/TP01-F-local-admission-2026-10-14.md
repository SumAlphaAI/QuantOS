# TP01-F canary、观测与回滚：本地开发

依据[开发计划 TP01-F](../SumAlpha-QuantOS-Development-Plan.md#task-tp01-f)，先由 `ee34aed0` 同步 TP01-E 的最新复验与实现待验收状态，再补齐本项本地机制。当前为冻结前实现/回归记录；完整 29 节点准入尚未运行，E/F Gate 均 NOT_ASSESSED，formalAccepted=false、targetCanaryAccepted=false、targetRollbackAccepted=false。冻结执行结果将独立记录，不将本节预检冒称同 SHA 完整准入。

## 实现

- 新增 `engines/vibe-adapter/src/vibe_adapter/rollout.py`：宿主提供 key/policy，对实际 candidate/previous catalog 字节进行 HMAC-SHA256 验签，固定 QuantOS 原生协议 provider；默认禁用、5% 稳定分流、独立影子制品、阈值告警、动作/提交共锁、epoch 撤销和已提交结果确定性收尾。
- 更新 service/server：实际 UDS Execute/StreamExecute 受 flag 控制，只允许 TEST/RESEARCH；原 unsigned 合成回归必须显式 fixture_mode/--fixture-routing。更新 Python 契约测试与 Rust EngineManager Vibe 启动参数。
- 新增 `local_drill.py`、47 项 Python 回归与 19 条独立 UDS 演练，保存签名 descriptor、实际 catalog 字节和连续 audit events。公开 fixture authority 只用于本地演练，未使用生产凭据。
- 更新原策略模拟/rollback 脚本：输入类型/NaN/缺测拒绝、缺影子证据阻断、禁用流量为0，动作不清除事故，明确 SYNTHETIC_POLICY_SIMULATION 与目标 NOT_RUN。
- 新增功能回执生产者、复制原件负向、29 节点专用 Gate、同候选 E 子集派生及 E/F 成对失败回滚；登记 policy/两计划/发布移交契约、Makefile 入口。
- 更新 dashboard/alert 配置、rollback runbook 与[本地准入规程](../operations/tp01-f-local-admission.md)。本地 snapshot 字段明确映射，runtimeMetricExport=false；未部署目标监控。

## 冻结前测试

| 命令 | 实际结果 |
| --- | --- |
| `engines/.venv/bin/python -m pytest engines/tests/test_vibe_adapter_rollout.py engines/tests/test_vibe_adapter_skeleton.py engines/tests/test_vibe_adapter_contract.py -q` | 早期 UDS 版179 PASS；后续增加环境/控制面/提交后stream/跨制品idempotency负向，新增总数47，最终以冻结执行为准 |
| `engines/.venv/bin/python -m vibe_adapter.local_drill ...` | 19/19 实际 UDS 演练 PASS |
| `node --test --test-reporter=tap scripts/tp01-f-functional.test.mjs scripts/tp01-f-local-gate.test.mjs scripts/tp01-f-plan-contract.test.mjs scripts/tp01-e-local-gate.test.mjs scripts/tp01-e-plan-contract.test.mjs` | 141/141 PASS，记录为非冻结开发预检 |
| `node --test --test-reporter=tap scripts/development-plan-order-negative.mjs scripts/provider-a1-receipts.test.mjs` | 98/98 PASS |
| `cargo test --locked --offline -p quantos-engine-manager --test python_vibe_adapter` | 2/2 PASS |
| `node scripts/check-tp01-f-style.mjs` | Ruff check/format、Pyright PASS |
| `node scripts/check-development-plans.mjs` | PASS，159 NOT_ASSESSED，0 READY |

原日志在[development-01](./evidence/tp01-f-local-20261014/development-01/python-local.log)及[development-02](./evidence/tp01-f-local-20261014/development-02/dedicated.log)。初次沙箱运行无法绑定 UDS，实际 27 PASS / 8 FAIL / 144 ERROR，未授予 Gate；[失败摘要](./evidence/tp01-f-local-20261014/development-01/sandbox-failure.json)明确未保存完整原 stdout，仅原工具执行保留。随后允许本机 UDS、去除凭据环境的复验通过。初始 Pyright 类型、F 复制测试 profile 指向及 Beta prose/JSON 对齐失败均在开发中修正，不升级为历史 PASS。

## 未执行与下一任务

29 节点完整必要闭包、三次可复现构建及最终门禁还需从干净新候选实际执行。旧 E 源码证明不能承担 F 新候选的共同输入。仅将本轮共同执行派生为 E 28 节点子集，保留旧冻结原件。

继承 22 组 Supabase/外部/性能移交，另保留实际连续7天无未解释P1、目标环境≤5分钟回滚、正式 authority/签名制品、业务控制权限、持久 audit/跨进程恢复与目标监控。均 NOT_RUN。本机回滚的是已验签的研究 catalog/provider，不代表 Python wheel/容器/部署二进制回滚。未连接数据库，未派发远程 workflow、issue/PR、push 或部署。

下一任务为 TP01-G 本地原生协议隔离/模块替换回归与替换计划；上游贡献只形成可审阅 patch/说明，外部提交需另行授权。SERVICE:TP01 准入须独立完整评估。
