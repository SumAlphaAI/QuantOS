# TP01-C：vibe_adapter skeleton 工程与 Gate 证据

> 本文为首次工程交付的历史报告；当时BLOCKED的receipt和日志已原样保留在[initial-blocked](./evidence/tp01-c-20261009/initial-blocked/receipt.json)。当前必要闭包复评与准入以[本轮报告](./TP01-C-development-admission-2026-10-09.md)为准，下文状态、未提交事实及旧Gate属于首次交付时点。

日期：2026-10-09（Asia/Shanghai）。依据：开发计划 R1-SERVICE 的 TP01-C；修改仓库仅 QuantOS。执行前 HEAD `3105e0de273e64010297d6a9d1e5509338cd46dd`，工作区干净；本轮源码未提交，实际内容绑定见 [receipt.json](./evidence/tp01-c-20261009/receipt.json) 的 `inputs`，不把 observed HEAD 当作包含未提交改动的候选 SHA。

**工程实现与检查 PASS；DEVELOPMENT 准入 BLOCKED；正式 ACCEPTED 未授予。**

## 交付与验收矩阵

已有 manifest、UDS/SDK 五 RPC、context translator、replaceable research provider 与20个 mock fixture，本轮复用并补齐输入、隔离和生命周期缺口；未新增上游源码吸收或生产 capability registry。

| 控制 | 实现和实际证据 | 结果 |
| --- | --- | --- |
| GetMetadata / Health / Execute / StreamExecute / Cancel | Python 共享五 RPC harness、Rust Manager→独立 Python UDS 进程；只暴露 research capability | PASS，5/5 |
| Context 与权限 | 只接收 prompt/fixture/tools/sleep_ms；拒绝嵌套身份覆盖、交易/secret/网络/文件/shell 字段与未知输入，限制 Research 模式；缺 research capability 拒绝 | PASS |
| 工具 allowlist | 输入类型验证、未知工具拒绝、显式空列表不授予工具；不回显任意工具名 | PASS |
| 安全 fixture | 20类字段×5种结构=100组，Execute/StreamExecute均拒绝，共200次调用；检查拒绝日志及无 Artifact 副作用 | PASS，100/100 |
| Egress / secret / venue | mock 只产生计划，不执行工具；Python socket连接/subprocess拦截时允许 fixture 仍成功，manifest无执行/venue/secret能力 | PASS，限本地 mock 代码路径；不宣称 OS 网络隔离 |
| Artifact API mock | 内存保存实际 JSON 字节，按 tenant读回/内容哈希、相同输入稳定ref、跨tenant不同ID且不可读；fresh facade同输入生成同ref | PASS；URI明确为 `mock-artifact://` |
| 幂等 | 同execution key不同输入/snapshot/policy/run/idempotency拒绝；保留run:idem形式，防分隔符别名混淆 | PASS；限进程内 |
| 取消 / deadline | owner=(tenant,workspace,actor,execution)，foreign Cancel拒绝；等待每10ms检查；Cancel与Artifact提交互斥；受控短deadline与取消均<2s且不写Artifact | PASS |
| 错误与审计 | payload拒绝不记值；未知fixture与provider异常返回稳定错误，不泄露path/secret/内部堆栈；SDK提供RPC观测 | PASS；非持久业务审计验收 |
| Replay / 可替换 / 可移除 | 20个fixture Execute/Stream回放、替换provider不改变QuantOS业务协议；新解释器禁止vibe import后mock五RPC可启动；Manager缺adapter路由检查 | PASS |
| UDS启动 | 必须absolute/unused，保留已有文件及symlink，新的CLI socket mode0600；Manager真实启动成功 | PASS |

## 测试命令与结果

最终运行入口：`node engines/vibe-adapter/check-development.mjs --record`。其7组命令全部退出0；原始日志、命令、时间、内容摘要见receipt及同目录日志。

| 命令 | 结果 / 日志 |
| --- | --- |
| `engines/.venv/bin/python -m pytest engines/tests -q` | **263 passed**；[Python日志](./evidence/tp01-c-20261009/python.log)；含140项adapter检查（原6+新增134） |
| `cargo test --locked --offline -p quantos-engine-manager` | **55 passed / 0 failed**；[Manager日志](./evidence/tp01-c-20261009/manager.log)；含adapter真实UDS 2项及其他Engine回归 |
| `engines/.venv/bin/ruff check engines/vibe-adapter engines/tests/test_vibe_adapter_skeleton.py` | PASS；[lint](./evidence/tp01-c-20261009/ruff.log) |
| `engines/.venv/bin/ruff format --check` 加receipt中列明的6个Python文件 | PASS，6 files already formatted；[format](./evidence/tp01-c-20261009/format.log) |
| `engines/.venv/bin/pyright --project engines --pythonpath engines/.venv/bin/python engines/vibe-adapter/src engines/tests/test_vibe_adapter_skeleton.py` | PASS，0 errors / 0 warnings；[types](./evidence/tp01-c-20261009/pyright.log) |
| `uv lock --check --offline --project engines` | PASS，52 packages；[lock](./evidence/tp01-c-20261009/lock.log)；未变更lockfile或依赖 |
| `node scripts/check-development-plans.mjs` | PASS，结构/顺序检查；[运行时计划日志](./evidence/tp01-c-20261009/plans.log)，日志时仍有历史14 READY，最终记录另见post-gates日志 |
| `node engines/vibe-adapter/check-development.mjs --verify` | 内容/日志/命令/当前依赖验证 PASS；工程PASS、stage BLOCKED |
| `node engines/vibe-adapter/check-development.mjs --ready` | 预期退出2，严格阻止阶段准入 |

初次沙箱内UDS绑定失败6项，保留[sandbox-uds-failure.log](./evidence/tp01-c-20261009/sandbox-uds-failure.log)；取得本地mock测试权限后真实UDS通过。初次pyright选中系统Python3.14产生导入错误，明确指定工程Python3.12后类型检查通过；uv缓存读取沙箱限制后只读离线校验通过。首次自动审批超时，按工具指示重试后成功；不存在待处理审批拒绝。

## Gate 与依赖事实

执行前严格 `validateReceipt` 分别验证 `CORE:TP01-B`、`CORE:F08`、`CORE-GATE:F0` 全部READY。代码修改后，严格内容检查对原14个登记READY节点全部报 `source/contract/config/test inventory or content changed`（包括通过依赖递归传播的节点），本轮完整组件回归不能替代各节点要求的全部检查和聚合receipt。

原阶段字段原样保存在[失效前快照](./evidence/tp01-c-20261009/prior-stage-records.json)，原57组日志/manifest、历史确认和正式签署均保留；开发计划将原14节点转NOT_ASSESSED。TP01-C登记 **COMPLETED（工程交付） / BLOCKED（阶段准入）**，证据摘要绑定本次receipt。当前计划登记 **0 READY、158 NOT_ASSESSED、1 BLOCKED**。不是撤销历史执行事实或用户确认，而是防止新输入复用旧放行。

`--verify`校验当前输入清单、每组实际命令/日志哈希与成功标记，并重新调用现有严格依赖验证；`--ready`只在依赖也有效时退出0。Gate摘要与失败门禁、篡改负向探针见[post-gates.log](./evidence/tp01-c-20261009/post-gates.log)。无需人工确认替代失败的工程依赖，也不自行批准正式验收。

## 未决风险与后续边界

1. **准入阻塞：**刷新必要依赖闭包的受影响输入和实际执行receipt，优先F08/F0；现有provider policy未覆盖CORE:TP01-C，后续若并入统一assess须显式增加该节点的范围/检查，不把结构PASS当作内容验收。本轮独立checker只证明TP01-C工程范围，不代替前置验收。
2. **持久服务：**Artifact对象、execution输入/owner/取消状态只在内存；进程退出不保留对象或取消，stable ref不等于持久恢复；maps针对有界fixture，无生产回收/容量验收。真实Artifact API、可信snapshot/policy解析及真实BFF/Runtime权限链由后续最小吸收/Research联调关闭。
3. **真实运行隔离：**没有OS egress隔离、LLM调用或真实工具执行；tool名称仅fixture计划。Metadata能力信任来自受审Manager，不独立验证JWT或持久policy授权；禁止将直接本地调用包装成真实租户/部署验收。
4. **发布与正式验收：**未跑Supabase数据库/Storage、部署HTTP/JWT E2E、三次正式制品构建/SBOM签名、hosted同SHA CI、长稳/canary或目标回滚；这些不计PASS，本轮不使用生产凭据、不发布或推送。

下一可执行工作：**复评当前必要依赖闭包并生成有效F08/F0及TP01-C准入回执**；随后依据TP01-C、R02和F0的当前有效DEVELOPMENT证据执行 **TP01-D（选择性吸收与最小patch队列）**，由R02的已批准质量/来源范围约束消费者，不采用失效旧回执。

## 待正式确认的审阅维度

本报告可作为后续完整确认文稿的工程事实输入。Product：仅fixture skeleton；Frontend：无页面Integrated；BFF：无部署/真实存储声明；QA：五RPC/回放/负向/取消/deadline证据；Security：deny-by-default与拒绝审计、无运行期秘密/venue能力；Risk：无交易执行及新用途许可。依赖准入尚未闭合，本轮不请求用户批准一个可放行的正式候选。遵循[项目用户确认流程](../gate-records/user-acceptance-confirmation-workflow.md)，后续由Codex拟完整文稿、用户一人确认后记录并独立执行门禁。

变更文件：开发计划、本报告、adapter README和独立evidence checker、allowlist/context/artifact_api/service/server五个实现文件、新增test_vibe_adapter_skeleton.py，以及本报告链接的证据目录。未修改第三方副本、共享SDK、数据库迁移或锁文件；无本地提交/推送/外部发布。
