# TP01-D 本地接口、fixture 与 R02 合成输入预检（2026-10-12）

本轮结果待收口。首次源码/预检执行器冻结提交为 `0ee2d0c697f2f2da8dbd0dd06718be283550319a`。本轮是聚焦必要前置预检，不授予完整闭包准入。

## 本地准入范围

[`TP01-D_LOCAL` 范围文稿](./TP01-D-local-scope-2026-10-12.md)及[机器清单](./evidence/tp01-d-preflight-20261012/scope.json)已完成：唯一消费者 CORE:TP01-D，直接依赖 TP01-C/R02/F0，必要本地闭包严格 16 节点。现有命令映射 53 组，14 组目标/远程治理检查 NOT_RUN，由测试/RELEASE-GATE:BETA 首次发布前实际验收。

正式实现仍须新增专用负向检查并重算最终检查数，从新的干净冻结提交完整执行全部 16 节点。当前 profile 为 PROPOSED_NOT_REGISTERED，现有执行器会拒绝它；本轮回执不能拼接为下一候选的准入。TP01-D、R02、F0 和 R1-SERVICE 均不新授 READY；原 TP01-C_LOCAL 保持有效，全图 1 READY / 158 NOT_ASSESSED / 0 BLOCKED。

## 接口与合成输入核对

- TP01-D 既有两项 conceptual patch queue 仅吸收 workflow decomposition / streaming phase projection 设计，固定上游 SHA `c33133f4fd5e978d21d2a61fdd8787fb352b4687` 和参考摘要；无上游代码导入或 patch 应用。
- 20 个具名 fixture 每项 Execute 两次、StreamExecute 两次，共 80 次实际 RPC；断言输出、Artifact 引用/读回、三阶段顺序、审计身份和幂等稳定。另有 18 类坏合约双 RPC 拒绝及无副作用检查。
- 禁止 Python 子进程导入 vibe_adapter 后，实际 Runtime→Manager→UDS→RD-Agent 完成十次研究与取消功能，证明其他 workflow 不依赖 adapter。
- R02 输入来自两个测试文件内构造的 InMemoryDataSnapshotCatalog / DataSnapshotRecord 和合成 payload/hash/lineage；[输入来源说明](./evidence/tp01-d-preflight-20261012/attempt-01/synthetic-inputs.json)绑定实际源码摘要。测试标签 approved.binance.spot / internal-approved 不授予真实来源或许可证权利。
- 未读取已退役的 32 条行情事实、未新采集、未连接数据库。质量/hash/租户/时间/用途边界及真实本地 Engine 消费分别验证。

## 执行与测试结果

实际命令（执行器移除数据库/目标凭据与 opt-in、设置 QUANTOS_SKIP_ENV=1、固定 pnpm 10.20.0）：

```sh
node docs/audit/evidence/tp01-d-preflight-20261012/run-preflight.mjs attempt-01
```

完整 [执行台账](./evidence/tp01-d-preflight-20261012/attempt-01/execution-results.json)、[回执](./evidence/tp01-d-preflight-20261012/attempt-01/receipt.json)、[fixture 矩阵](./evidence/tp01-d-preflight-20261012/attempt-01/fixture-matrix.json)保留命令、时间、退出结果、日志与摘要。

| 命令/检查 | 结果 |
| --- | --- |
| scope.test.mjs | 25/25 PASS，范围/越权/缺闭包/目标转移/合成用途负向 |
| pytest test_vibe_adapter_absorption.py -vv | 44/44 PASS，含 20 组 fixture / 80 RPC 与 18 类坏合约 |
| cargo test -p quantos-runtime --test research_orchestration research_workflow_ | 2/2 PASS，实际 adapter 导入拒绝标记与十次研究/取消 |
| node --test scripts/tp01-d-patch-queue.test.mjs scripts/tp01-d-functional-artifacts.test.mjs | 31/31 PASS |
| pytest engines/tests -q | 1382 PASS |
| cargo test -p quantos-engine-manager --locked --offline | 55 PASS |
| make r01-check | PASS，静态/负向、100000 回放、原子账本和两项实际编译变异拒绝 |
| make r02-check | 待收口 |
| node scripts/r02-engine-consumers.cjs | 待收口 |
| R1 回执负向与进程探针 | 待收口 |
| 本地 baseline/capability/intake、format/ruff/lock/计划/移交 | 待收口 |
| 最终 owned 进程收尾 | 待收口 |

原 TP01-C_LOCAL 在当前功能输入上递归检查 PASS；旧 TP01-D --ready 实际 exit 1（功能输入漂移）、严格 R02 admission exit 2（R01 当前未准入）、F0 严格验证 exit 1（依赖不是 READY）。这些是预期拒绝，不能记为目标故障已恢复。

## 失败保留与风险

首次 attempt-01 的 25 组命令全部 PASS，但 final-01 的证据核验及基线测试因新增验证器读取完整 Git 树时触及默认缓冲区上限（spawnSync git ENOBUFS）而 FAIL；原始结果保留，不作为当前可准入证据。验证器显式提供 32 MiB 有界缓冲区后，冻结新提交并完整重跑 attempt-02；不拼接第一次命令回执。

历史 TP01-D 组件/前置失败、TP01-C 初始 BLOCKED/UDS 失败和 F0 HTTP500/只读数据库/F09 调度失败均原路径保留；本轮 [preserved-evidence.json](./evidence/tp01-d-preflight-20261012/attempt-01/preserved-evidence.json)记录 732 文件摘要，结束时逐字节复核。所有新尝试独立编号，拒绝覆盖既有 attempt。未修改 canonical 组件回执或两份计划阶段字段。

本地 Artifact/审计投影、合成来源标签、静态迁移/RLS 检查不能证明真实持久化、真实数据用途或数据库验收。Supabase 可写性、PostgreSQL/Auth/Storage 持久链、真实部署与权限、远程治理、OS egress、真实 provider/LLM/工具、性能/容量/长稳和同 SHA hosted CI 均保持 NOT_RUN；正式验收需 ProjectUser 确认，formalAccepted=false。

未升级订阅、未使用生产凭据、未推送/外部发布、未启动本机 PostgreSQL/Supabase/Docker 或临时数据库。编译变异仅复制源码，不建立数据库。

## 变更与下一任务

本轮只新增本地范围文稿、审计执行器/验证器/负向测试和原始证据；既有 TP01-D 生产实现与锁文件未改动。完整变更文件与封存摘要在收口时生成。源码冻结提交 `0ee2d0c6`；证据另作本地提交。

下一可执行任务：**实现 TP01-D_LOCAL 本地准入及专用负向测试，从新冻结提交完整复验 16 节点必要本地闭包**。先注册单消费者/目标移交范围、补齐独立回执与回滚/拒绝测试，按新策略计算完整命令集，再实际执行；不得由本次预检自动放行 R1-SERVICE 或发布。
