# TP02 本地接口、fixture、安装 wheel 与必要前置预检（2026-10-12）

结果：**本地预检 PASS；TP02_LOCAL 为 PROPOSED_NOT_REGISTERED，TP02 / R1-SERVICE 均 NOT_ASSESSED**。冻结提交 `23579693c2478d42d3990408aad362c63e3b5d7f` 从干净工作区完整执行 30/30 组预检（含两项预期拒绝），没有拼接旧候选回执。本轮完成范围定义和聚焦预检，不是完整闭包 admission。

## 准入范围与闭包

[范围文稿](./TP02-local-scope-2026-10-12.md)和[机器范围](./evidence/tp02-preflight-20261012/scope.json)约束唯一消费者 CORE:TP02，直接依赖 CORE:F08、CORE-GATE:F0。必要本地闭包共 13 节点，依赖后序为：

```text
F01 → F03 → F04 → F05 → F06 → F07 → F08 → F02 → F09
→ TP01-A → TP01-B → F0 → TP02
```

箭头仅表示执行后序，不表示相邻节点之间新增依赖。范围映射 44 组既有唯一本地命令；12 组目标/远程检查保留原命令、记 NOT_RUN，移交测试/RELEASE-GATE:BETA。未来实现必须加入 TP02_LOCAL 专用负向检查、重新计算最终检查数，从新干净冻结提交完整执行全部 13 节点。当前执行器拒绝尚未注册的 TP02_LOCAL；不得使用本轮 30 组预检代替 44 组映射命令或拼接 TP01-D、旧 R03 回执。

阶段字段未修改。全图保持 **1 READY / 158 NOT_ASSESSED / 0 BLOCKED**，唯一 READY 为既有 TP01-D_LOCAL；本轮递归复核其当前有效输入，原来源仍是 `4fe846efe3d6187118c82fbffd69ed9bd00bcdac`，并未在新候选重跑其 54 组闭包。F08、F0、TP02 均不新授 READY。

## 接口、fixture 与安装包

- QuantOS 自有 fixture provider 提供 `research.hypothesis.v1` / `research.experiment.v1` 两个 capability，输出 ResearchArtifact；未启动或导入 Microsoft RD-Agent 上游运行时。
- `hypothesis_regime_shift` / `experiment_factor_stability` 两组 fixture 各 Execute 两次、StreamExecute 两次，至少 8 次具名确定性调用，另有五 RPC harness 调用。实际 UDS 回放比较 output/input hash、Artifact 引用/读回与流序列；交易/secret/任意外网工具、非研究模式、身份冲突、取消/deadline/transport stop、幂等及 Artifact tenant/owner/hash 边界均保留测试。
- Runtime→Manager→UDS→RD-Agent 的研究与取消测试实际通过，日志包含 Python 子进程不能导入 vibe_adapter 的标记。R02 输入为 Runtime 测试内合成 catalog/record；没有读取已退役 32 条事实或新采集。
- DataSnapshot 和 `query_snapshot` 是 fixture 输入标签；`snapshotBytesResolved=false`、`toolsExecuted=false`。本轮不证明真实 snapshot 字节消费、真实工具执行、真实来源许可或数据库持久化。
- 实际构建 SDK/RD-Agent 两份 wheel，离线安装至全新临时 venv，Python `-I` 从 site-packages 导入并启动独立 UDS 子进程，五 RPC / 两 capability / 权限拒绝通过。固定 grpcio 1.74.0 / protobuf 5.29.6 运行时来自已安装锁定依赖，不访问包索引；子进程已回收。
- [wheel 检查](./evidence/tp02-preflight-20261012/attempt-01/wheel-inspection.json)核对嵌入 catalog/service 与源码字节一致、无 editable 路径，保留两份实际 wheel 字节和 SHA-256。SDK 39570 bytes，RD-Agent 10324 bytes；[组件工程回执](./evidence/tp02-preflight-20261012/attempt-01/component/receipt.json)及原始 package 日志相互核对。

新组件回执 `engineeringStatus=PASS`，但按原严格依赖模型仍 `status=BLOCKED`（F08/F0 未严格 READY）；这不是全图阶段 BLOCKED，也不是 TP02_LOCAL 已准入。预检验证器显式返回 stageGate=NOT_ASSESSED，不覆写 canonical。

## 实际执行与测试

执行器移除数据库、Supabase、凭据及目标 opt-in，设置 QUANTOS_SKIP_ENV=1、UV_OFFLINE=1、CARGO_NET_OFFLINE=true，并固定 pnpm 10.20.0：

```sh
node docs/audit/evidence/tp02-preflight-20261012/run-preflight.mjs attempt-01
node docs/audit/evidence/tp02-preflight-20261012/run-final-checks.mjs attempt-01 final-01
python3 docs/audit/evidence/tp02-preflight-20261012/seal-evidence.py --verify
```

原始命令、时间、退出码、超时/信号、日志和摘要见[执行台账](./evidence/tp02-preflight-20261012/attempt-01/execution-results.json)、[回执](./evidence/tp02-preflight-20261012/attempt-01/receipt.json)、[验证结果](./evidence/tp02-preflight-20261012/verification.json)与[收尾台账](./evidence/tp02-preflight-20261012/final-01/results.json)。

| 命令/检查 | 实际结果 |
| --- | --- |
| node --test scope.test.mjs | 29/29 PASS，范围、闭包、目标转移、凭据剥离及越权拒绝 |
| make f08-check | PASS；完整 Python 1382 项及 Manager、lint/type/format、Python/Rust 覆盖检查 |
| make f08-nightly-check | PASS，实际 branch instrumentation 与覆盖负向检查 |
| node scripts/f0-development-checks.mjs --engine | PASS，安装后 mock Engine 服务与生命周期；12 份 receipt/日志/wheel 支撑文件保存 |
| 本地 TP01 baseline/capability/intake | PASS，远程治理未执行 |
| pytest test_rd_agent_contract.py test_rd_agent_development.py -vv | 131/131 PASS，含两组具名双 RPC 回放 |
| pytest engines/tests -q | 完整 1382 PASS、0 skipped；与 F08 覆盖运行分别执行，不累计为独立用例数 |
| cargo test --locked --offline -p quantos-engine-manager --test python_rd_agent | 2/2 PASS |
| cargo test --locked --offline -p quantos-runtime --test research_orchestration research_workflow_ -- --nocapture | 2/2 PASS |
| python scripts/tp02-packaged-service.py | PASS，实际两份 wheel / 隔离安装 / 五 RPC / 子进程回收 |
| TP02 Ruff / format / Pyright / lockfiles / intake | 全部 PASS，10 组组件检查全部通过 |
| node --test scripts/tp02-functional-artifacts.test.mjs | 26/26 PASS，含完整 Python 回执计数增长与不完整总结拒绝 |
| R1 回执负向与真实进程探针 | 130/130 PASS，0 skipped |
| node --test verify-preflight.test.mjs | 27/27 PASS，缺前置/日志/fixture、换 wheel、异常执行、候选漂移及越权拒绝 |
| pnpm test:development-plans | 40/40 PASS；计划/移交/diff/secret 扫描通过 |
| 最终进程清理 | PASS，独立候选/scope，discovered=[]、remaining=[] |

预检 30/30 组通过；最终 11/11 组通过（含既有 TP01-D 发布 Gate 预期拒绝）。证据验证校验 1270 项输入（1269 文件、1 Git link）与冻结 Git 字节一致，15 份支撑文件含 3 份压缩覆盖 JSON，解压摘要一致。未以运行耗时替代性能验收。

## 失败保留与未决风险

旧 TP02 `--ready` 实际 exit 1（functional inputs changed），严格 F0 实际 exit 1（dependency is not READY），均作为预期拒绝保留日志；TP01-D release check 实际 exit 2（release target evidence NOT_RUN）。这些拒绝不能记为目标恢复或发布通过。

[历史证据清单](./evidence/tp02-preflight-20261012/attempt-01/preserved-evidence.json)前后核对 926 文件摘要一致，包含 canonical TP02、旧准入/R03 前置及 Python 回执计数/安装依赖失败、F0 HTTP500/只读/F09 调度失败，以及 TP01-D 预检 ENOBUFS 和最终链接失败。未覆盖旧目录、删减失败或改写原计划阶段字段；本轮 attempt-01 和 final-01 无新增非预期失败。

未决项：完整 13 节点 TP02_LOCAL admission 尚未实现/运行；真实 snapshot/tool/provider/LLM、Supabase 可写性、PostgreSQL/RLS/Auth/Storage/持久 Artifact/审计/恢复、部署 JWT/权限、远程治理、OS egress、P95 接收 <1s、代表性负载/容量/长稳/平台矩阵、同 SHA hosted CI 和 ProjectUser 正式确认仍待测试/发布验收。目标检查均 NOT_RUN，formalAccepted=false。本轮无新数据库、本机 PostgreSQL/Supabase/Docker/临时数据库、生产凭据、订阅升级、推送或外部发布。

## 变更、提交与下一任务

本轮只新增 [范围文稿](./TP02-local-scope-2026-10-12.md)、预检/验证/负向测试脚本、本报告与原始证据；现有接口实现、fixture、锁文件及规范计划未改动。完整[变更文件](./evidence/tp02-preflight-20261012/changed-files.txt)和[封存摘要](./evidence/tp02-preflight-20261012/seal.json)随证据提交。范围/脚本冻结提交 `23579693`；最终证据另作本地提交，其哈希在任务完成回复报告。

下一可执行任务：**实现 TP02_LOCAL 本地准入及专用负向测试，从新冻结提交完整复验 13 节点必要本地闭包**。注册单消费者、本地/发布范围、同候选完整索引与 wrapper，补齐缺闭包/异常执行/换 wheel/发布回滚/正式越权拒绝，再重算并实际执行完整命令集；不得由本轮预检直接放行 R1-SERVICE。
