# F01 整改与验证记录

> 2026-09-17；对应 [初审报告](./F01-comprehensive-review-2026-09-17.md)。初审是历史快照，本文件记录后续整改。

## 实现整改

- A02：独立 Git archive 源码副本；拒绝脏工作区和少于三次；自动枚举 7 个 Rust binary、8 个 wheel、7 个 Web/package 输出；双向检查产物清单，失败撤销旧成功回执。
- A03/A04/A06：uv 版本预检；锁定 Hatchling 及完整构建依赖闭包；Cargo/uv/pnpm manifest 一致性与 Buf lock 结构检查。
- A05/A10：补齐 auth、policy、BFF README；服务目录索引与实际成员核对，45/45 模块根文档检查。
- A07：一期 pnpm workspace 明确包含 website、terminal、packages；Desktop 采用独立 workspace/lock 与手动 CI。
- A08：Terminal 默认 lint 覆盖 app/src/tests 的 TS/TSX。
- A09：通过 [ADR](../adr/20260917-f01-rust-test-runner.md) 正式采用固定 Rust 工具链下的 cargo test，保留集成测试和 doctest，无删减用例。
- A01：新增带 source commit/tree、平台、工具链、计时、命令退出码和逐文件 digest 的验收器；已生成干净提交的真实运行回执。

## 本地验证

`make lockfile-check f01-check lint test` 在干净源码副本中整体通过，另有工作区分批复验。16 个负向/隔离测试通过：产物变化与缺失、额外产物、空输出、目录清单漂移、脏/未跟踪输入、README 删除、uv 漂移、无效锁、三语言 manifest 漂移、Buf 无效锁、TSX lint 注入、旧回执失效、Desktop 损坏隔离。Python 91 项、一期 TypeScript 115 项通过；Rust 工作区通过（无凭据提前返回的测试不是目标数据库验收）。

证据总入口：[summary.json](./evidence/F01-remediation-2026-09-17/summary.json)，含文件哈希。PRE-06 回归检查通过；初审探针已固定历史源码 SHA 并成功重放，修复后的负向门禁另见本次测试日志。

初始新增审计探针存在 Ruff 格式问题，已格式化并复验。生产凭据与真实业务环境未使用。

## 正式验收

执行顺序：提交实现以建立不可变 SHA；在该干净提交运行 clean-room 与三次构建；最后提交回执和最终状态文档。验收器清除环境凭据并禁用 `.env` 加载。

状态：**PASS / ACCEPTED**。10 个问题全部 CLOSED；检查点 20/20（100%），F01 三项量化验收 3/3。F0 总体 Gate 不随本次自动放行。

- 实际验收源码提交：`6059310c4f3a2159f04e951a9308a5aae4d0366b`；两组回执都记录 `dirty=false`，源树一致。后续证据提交仅更新审计/状态材料，不改变该实现。
- 新环境：macOS arm64、预装固定工具链、空 Cargo/uv/pnpm 下载缓存、空安装和构建目录，`bootstrap → lockfile-check/f01-check → lint → test` 共 **948.682 秒**（上限 1800 秒）。[真实回执](./evidence/F01-remediation-2026-09-17/clean-room.json)、[日志](./evidence/F01-remediation-2026-09-17/clean-room.log)。
- 连续三次构建：每轮完整删除并重建固定物理路径下的源码、安装和构建目录，仅允许共享包下载；固定安装路径是 Next/Webpack 模块编号的构建输入；7 个 Rust binary、8 个 Python wheel、7 个 Web/package 输出全部核对。合并 SHA-256：`b9ae04ac55dd89a40d99890d6a24868af3fbc17ace3e9815ef0710cde0916a48`，三次一致。[真实回执](./evidence/F01-remediation-2026-09-17/three-builds.json)、[日志](./evidence/F01-remediation-2026-09-17/three-builds.log)。
- README：45/45 模块根通过；负向测试 16/16；Rust 186 passed / 1 ignored，Python 91、一期 TypeScript 115 项通过。源清单、逐文件哈希、工具链版本、平台、命令退出码与时间均可从回执复核。
- uv manifest 漂移探针改为先验证同一未修改副本通过，再注入漂移；额外使用空 uv 解析缓存覆盖冷启动条件。8 个 Python 成员逐个注入 Hatchling 版本漂移均被拒绝，见 [补充探针](./evidence/F01-remediation-2026-09-17/build-backend-probe.py) 和 [结果](./evidence/F01-remediation-2026-09-17/build-backend-probe.json)。
- 真实构建发现并修复了额外问题：macOS 必须规范化 `/tmp` 路径后执行 Rust 路径映射；Next/Webpack 必须固定物理安装路径并逐轮彻底重建；wheel 构建必须显式选择工作区 Python；uv 输出目录的 `.gitignore` 是工具元数据，允许其固定内容但继续拒绝其他多余产物。失败回执保留在证据目录，未作为成功验收。
- 串行初始化的慢网下载暴露了时限风险；现改为工具链预检后并行初始化 Rust/Python/Node，再统一 lint/test。Cargo 采用禁用 HTTP 多路复用的兼容配置；全部网络下载时间仍计入本次冷启动耗时。之前取消的串行试跑不作为通过证据。

这是实际 macOS 新环境的本地验收，不冒充 GitHub CI。远程 CI、真实数据库与浏览器矩阵未运行；它们不属于本次 Monorepo 初始化的新增功能验收，后续任务仍需独立回执。

## 问题关闭对照

| 问题 | 结果 | 验证 |
|---|---|---|
| A01 | CLOSED | 当前实现提交 clean-room + 三次构建真实回执 |
| A02 | CLOSED | 独立三次构建、全部产物清单及变化/删除/脏输入/旧成功回执负向测试 |
| A03 | CLOSED | 固定版本预检；错误 uv 拒绝；全新 bootstrap |
| A04 | CLOSED | 构建闭包锁与 constraints 一致；8 个 wheel 三次一致 |
| A05 | CLOSED | 45/45 README；删除模块 README 被拒绝 |
| A06 | CLOSED | 三语言真实 manifest 漂移、无效 Buf lock 均拒绝 |
| A07 | CLOSED | 一期显式 workspace；损坏 Desktop 不影响一期锁检查 |
| A08 | CLOSED | app TSX 错误注入触发默认 lint 失败 |
| A09 | CLOSED | ADR 与计划改为 Cargo 内置执行器；集成和 doctest 已执行 |
| A10 | CLOSED | 服务索引逐项对应 Cargo binary inventory |

## 完成率复核

沿用初审 C01–C20 的等权分母；PASS 20、PARTIAL 0、FAIL 0、NO RECEIPT 0，完成率 100%。三项量化验收 C17/C18/C19 全部通过。该比例只描述 F01，不表示 F0 或整个项目完成。

| 检查点 | 复验结果 | 依据 |
|---|---|---|
| C01 Cargo workspace | PASS | 23 个成员进入实际 lint/test；回执内源清单 |
| C02 proto | PASS | 原契约目录保留；生成 SDK 随工作区编译 |
| C03 crates | PASS | 16 个 crate 清单与目录双向核对 |
| C04 services | PASS | 7 个 binary 三次实际构建与逐文件 digest |
| C05 engines | PASS | 8 个 Python 成员、91 项 Python 测试 |
| C06 website | PASS | 独立 lint/typecheck/test 与三次静态构建 |
| C07 terminal | PASS | 独立 lint/typecheck/test 与三次静态构建 |
| C08 packages | PASS | 5 个共享包进入检查和构建图 |
| C09 supabase | PASS | 初始化目录、说明与迁移资产保留；不代表真实数据库验收 |
| C10 Rust 固定 | PASS | 1.91.0 预检及实际 fmt/Clippy/test/build |
| C11 uv 固定 | PASS | .uv-version 0.7.0、安装说明、错误版本拒绝 |
| C12 Node 固定 | PASS | Node 24.12.0 / pnpm 10.20.0 预检 |
| C13 锁与构建闭包 | PASS | 三语言冻结检查；Hatchling/传递依赖锁定；漂移负向验证 |
| C14 Make 任务 | PASS | 一期入口实际执行；Desktop 独立 workspace/lock |
| C15 本地环境基线 | PASS | README 工具安装、预检及构建路径约束；空缓存初始化回执 |
| C16 DATABASE_URL 约定 | PASS | 原示例环境与 Supabase 操作约定保持；未读取真实凭据 |
| C17 模块 README | PASS | 45/45 模块根、服务索引一致、删除 README 拒绝 |
| C18 新环境 ≤30 分钟 | PASS | clean-room.json 中 elapsedSeconds ≤1800、所有命令退出 0 |
| C19 连续三次构建 | PASS | 同一 SHA、三轮重新安装/构建、全部产物哈希一致 |
| C20 最低质量接线 | PASS | app TSX 纳入 lint；正式 ADR 对齐 Cargo 执行器；三语言 lint/test 全通过 |

## 保留边界与后续执行

- GitHub CI 尚未触发；本次没有推送远程。CI 已接入相同验收器并保留失败回执，远程结果应在后续推送后独立检查。
- 新环境口径为固定工具链已安装、包下载缓存为空；工具链安装不计入 bootstrap 时限。网络下载计入本次实测，不能保证任意网络条件都在 30 分钟内。
- 三次产物一致限定相同 OS/工具链/固定物理构建路径；Next/Webpack 的模块编号含路径输入，不作跨路径、跨平台或跨版本位级一致承诺。
- A09 依初审明确允许的正式规范变更完成，采用 Cargo 内置执行器及 doctest；没有安装或声称运行 nextest。
- 下一可执行步骤：按现有 PR/推送流程运行远程 F01 工作流；F0 其他任务及数据库、浏览器的验收继续按各自计划执行。
