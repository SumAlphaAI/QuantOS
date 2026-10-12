# R1-SERVICE 缺项与 TP01-C 本地预检（2026-10-12）

**TP01-C 本地接口、fixture 与必要前置预检 PASS；TP01-C / R1-SERVICE 准入均为 NOT_ASSESSED。** 新执行绑定冻结提交 `6d413b527d72e8a4b82c64a6d5a27335fa397984`：23 组预期结果全部满足，其中 20 组成功检查、3 组旧回执/范围拒绝。未修改运行时代码或发布阶段记录；全图仍为 5 READY / 154 NOT_ASSESSED / 0 BLOCKED，formalAccepted=false。

预检前 tracked 工作区干净；执行期间 1326 个功能输入与 26 个必要节点规范输入保持一致。新增执行器、验证器、负向测试和证据位于本报告的 audit 目录，不进入公共源码输入集。现有 F0 回执属于冻结 `54aeff32` 的 R04_LOCAL，当前内容重新校验 PASS；本轮没有把它改写为 `6d413b52` 的全闭包执行证明。

## R1-SERVICE 缺项盘点

依据开发计划的 `CORE-GATE:R1-SERVICE`，14 个直接依赖的传递闭包共 26 个节点；计入聚合 Gate 为 27 个节点。10 个直接依赖尚无当前准入，另外 4 个 READY 仅有既定消费者范围。历史 COMPLETED、历史目标 PASS 或 R04 的 consumer projection 都不能替代新的 R1 聚合回执。下表是缺项清单，不把尚未复验的组件推断为功能失败。

| 直接依赖 | 当前 Gate / 已有交付 | 本地准入仍缺的证据 |
|---|---|---|
| R01 | NOT_ASSESSED；market/ingestor/replay | 当前合成 replay、归一化/去重、受控质量告警与消费者拒绝的 R1 范围回执；真实持续新鲜度移交发布 |
| R02 | NOT_ASSESSED；snapshot/quality/typed reader | 当前合成 snapshot→质量/来源/时效拒绝→实际消费者闭环；不得重新消费已退役的 32 条事实 |
| TP01-C | NOT_ASSESSED；adapter skeleton | 本轮组件预检通过；仍需显式本地准入 profile、13 节点必要闭包完整执行与依赖摘要绑定 |
| TP01-D | NOT_ASSESSED；两项设计 patch queue | 当前 TP01-C/R02/F0 依赖、20 双 RPC 回放、移除 adapter 后其他 workflow 及进程清理的本地回执 |
| TP02 | NOT_ASSESSED；RD-Agent fixture Engine | F08/F0、本地确定性输入/输出、权限拒绝、wheel 与生命周期的当前消费者范围回执 |
| TP03 | READY，R04_LOCAL；LLMQuant | R1 聚合明确消费其功能范围，并绑定同候选输入与前置；不迁移严格数据库准入 |
| TP04 | READY，R04_LOCAL；TradingAgents | 同上；不可执行 Proposal、反方观点、证据/失效及订单/secret 拒绝仍须覆盖 |
| TP05 | NOT_ASSESSED；自有 OpenBB fixture provider | 当前 Data Contract/许可/来源/hash、生产排除及 F05/F08/F0 的本地回执；不引入真实 OpenBB 运行时 |
| TP08 | NOT_ASSESSED；Qlib reference_only | 当前三组离线映射、固定来源/许可证、生产排除及 F05/F0 的本地回执 |
| TP09 | NOT_ASSESSED；TrendRadar reference_only | 当前三组 Signal 映射、缺来源/许可拒绝、生产排除及 TP03/F0 的本地回执 |
| TP10 | NOT_ASSESSED；ValueCell IA 评估 | 当前设计锚点/十项以上模式、禁止源码复制/运行时依赖及 F0 的本地回执 |
| TP11 | NOT_ASSESSED；OpenStock reference_only | 当前两份合成 provider 映射、未授权 snapshot 拒绝、生产排除及 TP05/F0 的本地回执 |
| R03 | READY，R03_LOCAL | R1 聚合消费范围与同候选输入绑定；现有本地 Artifact/取消/重放不能证明目标持久化 |
| R04 | READY，R04_LOCAL | R1 聚合的研究→Signal→Proposal 证据绑定、拒绝、取消/重放与无订单副作用 |

还缺两项聚合设施：现有 `localPolicy()` 只接受 R03_LOCAL/R04_LOCAL，未登记 TP01-C 或 R1 的本地 profile；现有 `r1-target-assessment.mjs` 处理 R01/R02 目标证据，并非 R1-SERVICE 本地聚合验收器。下一轮应先实现消费者范围、必要检查清单、目标移交和失败拒绝，再从新冻结源码完整执行，不直接使用含目标命令的旧 `--assess-tp01-c`。

R02 原任务卡仍含真实 Supabase 开发硬门槛表述；新的消费者本地规则需要显式登记移交及合成输入范围，继续保留租户、来源、许可、质量和时效底线。本轮只盘点，不修改规范输入或自行迁移旧批准。

## 本地预检与测试结果

TP01-C 必要依赖闭包为 F01–F09、TP01-A/B、F0、TP01-C，共 13 节点。此次重跑直接相关的 TP01-B、F08、F0 结构/负向和 TP01-C 全组件，并验证已有 F0 本地回执；未声称重新执行其余基础节点的全部命令。全部命令、时间、退出/timeout/signal、日志摘要见[执行台账](./evidence/r1-service-preflight-20261012/attempt-01/execution-results.json)。

| 命令 | 结果 |
|---|---|
| `node scripts/f0-development-checks.mjs --capability` / `make tp-intake-check` | 11 项能力输入/输出/副作用/权限/替代清单与 intake PASS；没有执行读取 GitHub 凭据的 `--repository` |
| `pnpm check:development-plans` / `pnpm test:development-plans` / `node --test scripts/fep0-development.test.mjs` | PASS；计划负向 40 项，基础 receipt 负向 39 项 PASS |
| `make f0-local-check` | 现有 R04_LOCAL 递归内容校验 PASS，数据库 NOT_RUN；未转授 TP01-C |
| `make f08-check` / `make f08-nightly-check` | 功能/lint/type/覆盖率 PASS；Python 1382 项、Manager 55 项；稳定版一项分支负向 SKIP，nightly 实际执行五项覆盖负向，无新增豁免 |
| `node scripts/f0-development-checks.mjs --engine` | 实际安装非 editable wheel 的独立 UDS 服务 9 场景 PASS：五 RPC/租户、监督崩溃、deadline、取消、恢复/重放、幂等、Artifact 完整性、响应身份拒绝 |
| `engines/.venv/bin/python -m pytest engines/tests -q` | 1382 PASS，无失败/skip |
| `cargo test --locked --offline -p quantos-engine-manager` | 55 PASS，无失败/ignored；含实际 Python vibe_adapter UDS 与移除 adapter 的其他 Engine 路由 |
| `engines/.venv/bin/python -m pytest engines/tests/test_vibe_adapter_contract.py engines/tests/test_vibe_adapter_skeleton.py -q` | 140 PASS：五 RPC、20 固定回放、100 组×双 RPC 边界拒绝、tenant Artifact、取消/deadline/幂等、provider 替换与独立 Engine |
| adapter Ruff / 六文件 format / Pyright / `uv lock --check --offline --project engines` / 计划检查 | 五组 PASS；0 type errors/warnings，52 locked packages |
| `node --test scripts/tp01-c-functional-artifacts.test.mjs scripts/provider-a1-receipts.test.mjs scripts/local-development-gate.test.mjs` | 91 PASS，含伪造命令/源码/日志/正式批准、错误 SHA、缺检查及回执发布/回滚拒绝 |
| `make development-handoff-check` | 22 个后续任务/16 个检查点移交规则 PASS |
| `node scripts/r1-process-cleanup.cjs <本次输出>` | 实际进程快照与唯一 scope；discovered=[]、remaining=[]，PASS |
| `node --test docs/audit/evidence/r1-service-preflight-20261012/verify-preflight.test.mjs` | 11 PASS；覆盖伪 READY/目标 PASS/正式批准、缺检查/依赖、timeout、异源候选、源码/日志/支持制品替换 |

执行器移除数据库、Supabase、secret/key/token 与数据库 opt-in 环境，固定 pnpm 10.20.0，uv/Cargo 离线。实际命令未连接目标数据库，未执行生产工具或新数据采集。Artifact/取消/恢复结果均限 mock 与本地进程；轮子和三份压缩覆盖率原件在 [supporting](./evidence/r1-service-preflight-20261012/attempt-01/supporting-manifest.json) 中逐字节绑定。

## 失败证据与 Gate

旧 TP01-C `--verify` / `--ready` 均 exit 1，原因为 `current functional inputs changed`；严格 F0 exit 1，拒绝把 local wrapper 作为完整功能目标 manifest。本次三个预期拒绝的原始日志已保存，未通过重写旧 receipt 消除失败。未注册 TP01_C_LOCAL 也被显式拒绝。当前三项拒绝与旧 Supabase 故障分开记录，不能把它们解释为本次目标重测。

[历史证据清单](./evidence/r1-service-preflight-20261012/attempt-01/preserved-evidence.json)的 **2518 文件**全部哈希复核，包括 TP01-C 初次 BLOCKED/UDS 失败、原准入、R04 多次失败及当前 Gate；另对[F0 目标失败](./evidence/r1-service-preflight-20261012/attempt-01/retained-f0-failures.json)的 144 文件绑定完整复核。历史 Auth HTTP 500、只读库、调度超时、性能缺口保持原事实，未在本轮宣称解决。

- 预检：PASS；[专用回执](./evidence/r1-service-preflight-20261012/attempt-01/receipt.json)、[验证结果](./evidence/r1-service-preflight-20261012/verification.json)与[最终检查](./evidence/r1-service-preflight-20261012/final-checks.json)。
- TP01-C / R1-SERVICE：NOT_ASSESSED，缺本地 admission 的执行与聚合证明；Supabase 未作为本轮开发预检阻塞项。
- 数据库、外部环境、部署/持久化、代表性性能/容量/长稳与 hosted CI：NOT_RUN，保留测试/RELEASE-GATE:BETA 首次发布前验收责任；formalAccepted=false。
- 本轮未升级订阅、未使用生产凭据、未推送或发布；未创建本地 PostgreSQL/Supabase/容器。

## 下一可执行任务与 Git

**制定并实现 TP01-C_LOCAL 本地准入，明确 R1 消费者证据接口与 Supabase/外部/性能移交；补充负向测试，从新冻结源码完整执行 TP01-C 的 13 节点必要本地闭包。** 随后再刷新 TP01-D、R01/R02/TP02 及其余 reference-only 节点，最终生成 R1-SERVICE 聚合回执。不得依赖历史 COMPLETED 或当前四个 consumer-local READY 直接放行 R1-SERVICE/S01。

本轮只新增本报告及 `docs/audit/evidence/r1-service-preflight-20261012/` 的执行器、验证器、负向测试、日志/回执/原始支持制品与清单；完整变更见[changed-files.txt](./evidence/r1-service-preflight-20261012/changed-files.txt)。源候选为 `6d413b52`，文档/证据 Git 提交另行生成并在完成回复报告；证据提交不冒充同 SHA hosted CI 或正式 ACCEPTED。
