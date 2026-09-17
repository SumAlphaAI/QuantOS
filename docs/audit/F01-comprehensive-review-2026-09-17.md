# F01 初始化 Polyglot Monorepo 全面复审报告

> 日期：2026-09-17；依据：开发计划 v3.3 的 F01、§2.2、§2.3，以及架构和技术方案的工作区边界。计划随本报告更新至 v3.4。
> 源码基线：`a44220d26ffa9fa7ae5efd0e8e2c56e60eebd183`；开始时 `git status --short` 为空。本轮仅新增审计材料、更新计划，不修改实现、不生成 Git 提交。
> 结论：`CHANGES_REQUESTED`；开发状态修正为 `PARTIAL`。未达到 F01 放行条件，不推进 F0 Gate。

## 一、任务完成概况

三语言工作区已落地：Cargo 有 23 个成员（16 个 crate、7 个服务），uv 有 8 个 Engine/SDK 成员，pnpm 一期有 7 个成员（2 个应用、5 个共享包），另包含二期 Desktop。主要目录、Rust/Node 版本文件、语言锁文件、Make 入口和数据库连接约定均存在；本轮本地质量检查最终通过。

**严格完成率为 60%（12/20）**。将 F01 的技术要求、交付物及验收要求拆分为 20 个等权、互不重复的检查点：12 项通过、6 项部分完成、1 项门禁不合格、1 项缺少验收回执。仅通过项计入完成分子；部分项不折算 0.5 分，缺证据不推定实现失败。这是检查点完成率，不是代码量、工时完成率，也不代表 F0 阶段完成率。

**三项量化验收完整通过率为 0/3**：新环境 ≤30 分钟没有当前提交回执；README 覆盖不完整；三次构建缺少当前提交回执且验证器有漏检。问题共 10 项：阻塞级 0、高危 2、中危 7、低危 1。两项高危足以阻止本任务验收，但未发现需要将已确认问题定为生产事故级阻塞的问题。

验收边界：本轮使用 macOS 现有依赖缓存和工作区；未运行全新远程 CI、当前提交三次完整 release 构建、真实数据库或浏览器矩阵。它们均保留 `NOT RUN / NO RECEIPT`，不能以本地绿灯替代。Desktop 按 v3.3 属第二期；其检查仍混入一期命令被记录为范围问题。

## 二、完成情况明细统计

### 2.1 F01 需求与交付物逐项核对

| 编号 | 检查点 | 状态 | 当前证据与缺口 |
|---|---|---|---|
| C01 | Cargo workspace | PASS | `Cargo.toml`、locked/offline metadata 解析成功；23 个成员均能进入检查图 |
| C02 | `proto/` | PASS | 版本化 common/research/strategy/trading/engine/events 契约与 README 存在；SDK 进入当前编译图 |
| C03 | `crates/` | PASS | 16 个 crate 已纳入 workspace；目录存在性与文档完整性分别在本项和 C17 计分 |
| C04 | `services/` | PASS | 7 个服务全部注册为 Cargo binary，包括 bff-gateway、capacity-monitor |
| C05 | `engines/` | PASS | uv workspace 8 个成员；Python workspace 测试 7/7，完整 Python 测试 91/91 |
| C06 | `apps/website` | PASS | 独立 package、README、lint/typecheck/test 入口存在且执行通过 |
| C07 | `apps/terminal` | PASS | 独立 package、README、typecheck/test 可执行；lint 覆盖缺口归 C20 |
| C08 | `packages/*` | PASS | api-client/config/domain-ui/platform/ui 均被 pnpm 注册并完成本地检查 |
| C09 | `supabase/` | PASS | README、OPERATIONS、migration 和测试资产存在；未以目录存在推定真实数据库验收 |
| C10 | 固定 Rust 工具链 | PASS | `rust-toolchain.toml` 固定 1.91.0、rustfmt、clippy；本机版本核对一致 |
| C11 | 固定 uv 工具链 | PARTIAL | CI 固定 0.7.0，本机也是 0.7.0；本地 bootstrap 未安装或校验版本，README 只声称已固定，见 F01-A03 |
| C12 | 固定 Node 工具链 | PASS | `.nvmrc` 为 24.12.0，`packageManager` 为 pnpm 10.20.0，CI 一致；本轮使用该版本 |
| C13 | 锁文件与冻结依赖闭包 | PARTIAL | Rust metadata locked、uv lock check、隔离 pnpm frozen manifest check 通过；Python 构建后端未锁定、独立锁检查仅查非空，见 A04/A06 |
| C14 | Make 任务 | PARTIAL | bootstrap/lint/test/build/reproducibility 入口存在；一期入口仍强制包含 Desktop，见 A07 |
| C15 | 本地开发环境基线 | PARTIAL | 根 README、版本文件、示例环境存在；uv 本地固定方式缺失，与 C11 对应同一根因 A03 |
| C16 | `DATABASE_URL` 约定 | PASS | `.env.example`、`supabase/README.md`、`OPERATIONS.md` 定义目标、环境隔离及 reset guard；本轮未读取真实环境文件或连接数据库 |
| C17 | 所有模块目录 README 和边界 | PARTIAL | 一期 45 个模块/边界目录中 42 个有 README（93.33%），3 个缺失；服务索引也有漂移，见 A05/A10 |
| C18 | 新环境 bootstrap → lint → test ≤30 分钟 | NO RECEIPT | 有 CI 工作流，但仓库未提供当前提交的 clean-room 回执；未以缓存环境耗时替代，见 A01 |
| C19 | 跨语言连续三次可重复构建 | FAIL | 旧提交有本地回执，当前提交无回执；验证器对产物变化与陈旧输出误接受，见 A01/A02 |
| C20 | 全任务最低质量检查接线 | PARTIAL | 本轮 fmt/Clippy/Ruff/Pyright/TS lint/typecheck/test 最终通过；nextest 未接线，Terminal app 未纳入默认 lint，见 A08/A09 |

统计复核：PASS=12，PARTIAL=6，FAIL=1，NO RECEIPT=1，总计 20。C11/C15 是不同要求但同一根因，问题数量不重复计；验收统计 C17/C18/C19 为 0/3 完整通过。

README 分母定义为 7 个顶层边界目录 + 23 个 Cargo 成员 + 8 个 Python 成员 + 7 个一期 JS 成员。生成代码、`src/`、fixture、缓存及二期 Desktop 不计入该分母；因此 93.33% 仅是模块根 README 覆盖率，不宣称任意子目录都有文档。完整名单见 [inventory.json](./evidence/F01-2026-09-17/inventory.json)。

### 2.2 实际执行与证据层级

| 检查 | 最终结果 | 证据 |
|---|---|---|
| Rust 版本、workspace、fmt、Clippy | PASS；1.91.0；禁止 warning | [Rust 命令与退出码](./evidence/F01-2026-09-17/rust-results.json) |
| `cargo test --workspace --locked --offline` | PASS；62 个 harness 汇总 186 passed / 0 failed / 1 ignored | [完整日志](./evidence/F01-2026-09-17/rust-test.log) |
| uv 版本与 lock 一致性 | PASS；uv 0.7.0，Python 3.9.6 | [Python 命令与退出码](./evidence/F01-2026-09-17/python-results.json) |
| Ruff / Pyright / pytest engines | PASS；0 个类型错误，91 tests passed | [pytest 日志](./evidence/F01-2026-09-17/python-test.log) |
| pnpm lint / typecheck / test | PASS；一期 115 tests，额外二期 Desktop 1 test | [Node 命令与退出码](./evidence/F01-2026-09-17/node-results.json)、[测试日志](./evidence/F01-2026-09-17/web-test.log) |
| Terminal `eslint app --ext .ts,.tsx` 补充检查 | PASS；证明代码当前可 lint，不消除默认入口漏检 | [补充日志](./evidence/F01-2026-09-17/terminal-app-lint.log) |
| pnpm frozen manifest 一致性 | PASS；临时目录复制 manifests/lock，`install --lockfile-only --frozen-lockfile --offline --ignore-scripts` | [日志](./evidence/F01-2026-09-17/pnpm-lock-consistency.log)；不等于完整依赖安装 |
| `bash scripts/check-lockfiles.sh` | PASS；仅文件存在性 | [日志](./evidence/F01-2026-09-17/lockfile-check.log) |
| secret scan | PASS | [日志](./evidence/F01-2026-09-17/secrets.log)；不是在线 SCA 结论 |
| 无效锁文件、模拟变化产物、单次构建负向探针 | 3 个探针全部被错误接受 | [可重放探针](./evidence/F01-2026-09-17/probes.py)、[结果](./evidence/F01-2026-09-17/probes.json) |
| 新环境时限、当前提交三次完整构建 | NOT RUN / NO RECEIPT | [证据摘要](./evidence/F01-2026-09-17/summary.json) |

执行环境已去除数据库/服务凭据，依赖采用离线缓存。最初的 socket/cache 沙箱拒绝和 Pyright 误选系统解释器，经允许本机 socket、修正 PATH 后消除；Rust UDS 启动还出现过一次失败，uv 环境同步并单独复跑后全绿，确切根因未证实，不将该瞬态直接归为产品缺陷。日志保存最终复验；初始异常概况保存在 summary.json。

Rust harness 数量含无凭据时提前返回的数据库/Storage 测试，不能据此认定 PostgreSQL、RLS、Storage 已运行。覆盖率阈值针对新增领域/Engine/TS 业务代码；本轮仅审查 F01 基线、没有新增业务实现，不另给出业务覆盖率达标结论。性能、交易七类路径、消费者重放、浏览器矩阵属于相应任务的验收，未在 F01 审计中冒领通过；SDK 编译由现有工作区检查佐证，未声称完成 F03 的 Buf breaking 全量验收。

历史 `artifacts/reproducibility/f01-build-digests.json` 记录的是 `6b1066bfe62d19f3ed57a28b6484c8815c4416c3`、2026-08-09、3 次一致；同目录 smoke 为 1 次。两者均未受 Git 跟踪，不能证明本次源码基线。PRE-03 的缓存环境记录也不等于三语言 F01 clean-room 验收。

## 三、问题清单及风险分析

分级：阻塞级用于无法继续开发或明确严重边界破坏；高危用于可能错误放行或关键验收无法成立；中危用于可复现性、检查覆盖、范围或必要文档缺口；低危用于不直接影响执行的文档漂移。所有问题当前均为 `OPEN`。

| ID / 优先级 | 所属模块 | 具体表现与证据 | 影响范围 / 风险 |
|---|---|---|---|
| F01-A01 / 高危 | clean-room / 验收证据 | `.github/workflows/f01-clean-room.yml` 有任务，但没有当前 SHA 的新环境耗时或三次构建回执；旧回执落后于本次 SHA。clean-room JSON 本身也未写入 source commit、工具版本和 run ID | 新人初始化时限与当前三语言产物无法确认；单独传递 JSON 时无法自证来源，阻止 F01 接受 |
| F01-A02 / 高危 | 可重复构建验证器 | `scripts/verify-reproducible-builds.mjs` 的 `rustBinaries` 仅列 5 个，遗漏 bff-gateway/capacity-monitor；Web 在原工作区构建、不统一清除旧输出；允许 `--runs 1` 得到 `reproducible:true`；构建失败前不撤销旧 receipt，commit 标签也不证明干净输入 | 临时 SOURCE/MOCK 探针让遗漏服务的产物每轮变化、Web 完全不构建却保留旧输出，3 次仍返回成功；因此绿灯不能证明全工作区独立构建一致。固定 Make 入口使用 3 次，不把 1 次参数问题误报成 CI 默认只跑一次 |
| F01-A03 / 中危 | 本地工具链 / bootstrap | CI 设置 uv 0.7.0，但 `Makefile` 仅调用 PATH 中的 uv；README 未给出该版本、安装和漂移拒绝方法，仓库没有本地 uv 版本校验 | 新环境与 CI 可能使用不同解析器/构建行为；本机恰好为 0.7.0 不弥补交付缺口 |
| F01-A04 / 中危 | Python 构建依赖 | 8 个 Engine/SDK `pyproject.toml` 的 `[build-system].requires` 均为无版本 `hatchling`；`engines/uv.lock` 无 hatchling，构建脚本 `uv build` 未约束构建后端版本 | 同一锁文件可因隔离构建后端变化而产生不同 wheel；当前缓存不能证明跨时间可复现 |
| F01-A05 / 中危 | 模块文档 | `crates/quantos-auth`、`crates/quantos-policy`、`services/bff-gateway` 缺少自身 README；父目录对 auth/policy 的概述不能替代“所有目录有 README”验收 | 三处模块的入口、依赖边界及使用方式缺少就地说明；45 个一期模块/边界目录只覆盖 42 个 |
| F01-A06 / 中危 | 锁文件门禁 | `scripts/check-lockfiles.sh` 只检查 5 个文件非空；探针填入 `not a lockfile` 仍成功 | 单独的 lockfile-check 不能证明锁文件有效或与 manifest 一致；后续 frozen bootstrap 可能拒绝，故不将其夸大为所有 CI 都会误通过 |
| F01-A07 / 中危 | 一期 / 二期执行边界 | `pnpm-workspace.yaml` 的 `apps/*` 包含 Desktop；root `pnpm -r` lint/test/build、锁检查和 F01 reproducibility 都强制涉及 Desktop；当前计划已将 Desktop 移出一期 | 二期 Desktop 删除/损坏可阻塞一期 F01；一期可重复性结论混入二期产物。Cargo 已正确 exclude Tauri，问题限于剩余入口 |
| F01-A08 / 中危 | TypeScript lint 入口 | `apps/terminal/package.json` 的 lint 为 `eslint src tests --ext .ts`，没有 App Router `app/` 和对应 `.tsx` 页面 | 默认 lint 绿灯遗漏主要页面层。补充运行 app lint 当前通过，但未来页面回归仍无法由既有入口阻止 |
| F01-A09 / 中危 | Rust 测试规范接线 | 计划 §2.2 要求 cargo nextest，Make/CI 使用 cargo test，未安装或调用 nextest；本机 `cargo nextest --version` 返回 101 | 测试执行器与明文验收规范不一致；现有 cargo test 结果有效，但不能声明 nextest 验收通过 |
| F01-A10 / 低危 | 服务索引文档 | `services/README.md` 仍称 “All six Rust binaries”，Cargo metadata 实际为 7 个；目录清单也未完整列出服务 | 服务规模与 ownership 导航失真，增加维护遗漏风险；不单独证明运行错误 |

风险关联：A03/A04 影响新环境可复现性；A02/A06/A08 使局部绿灯被误当作完整检查；A05/A07/A09 是明确需求或范围不一致。A01 为证据缺口，不能解释为已确认远程 CI 失败；本轮未获取远程运行状态。没有发现秘密泄漏，不将工具版本或无效锁探针推定为实际供应链入侵。

## 四、整改建议

| 顺序 / 建议责任角色 | 对应问题 | 整改内容 | 关闭条件 |
|---|---|---|---|
| 1 / 构建与 CI 维护者 | A02、A07 | 按一期 manifest 自动枚举 Rust binaries、Python wheels、Web 输出；校验清单双向一致。独立干净目录构建，拒绝残留输出、脏源码和不足 3 次的正式验收；失败应生成失败记录并使旧成功记录不可复用；二期入口独立 | 删除任一交付物、改变任一 binary、模拟空构建、传入 1 次或脏源码都必须被正式 Gate 拒绝；仅改动 Desktop 不得无条件阻断一期 F01 |
| 2 / 工具链维护者 | A03、A04、A06 | 明确本地 uv 安装版本并 fail-fast；锁定/约束 Python 隔离构建后端；对 Cargo/uv/pnpm manifest 与锁执行真实一致性检查 | 错误 uv、无效锁、manifest 漂移、构建后端漂移负向用例全部拒绝；冻结输入可在干净副本解析 |
| 3 / 模块维护者 | A05、A10 | 补齐 3 个 README；更新服务索引和边界，注明输入输出、允许依赖、运行与测试入口 | 一期 45/45 模块根有有效 README，服务索引与 metadata 一致；删除 README 的探针失败 |
| 4 / 前端及 Rust 维护者 | A08、A09 | 将 Terminal app/TSX 纳入 lint；安装固定 nextest 并接线，或通过正式规范变更明确 cargo test 替代范围与理由 | app 注入 lint 错误必须使根 lint 失败；测试执行器与计划一致，结果有可追溯日志 |
| 5 / 验收责任人 | A01，复核 A02–A09 | 修复后在当前源码提交运行完整 clean-room 和连续三次构建；记录 SHA、dirty 状态、OS/架构、工具链、缓存与下载条件、起止时间、命令退出码、逐文件 digest、CI run/artifact 链接 | ≤1800 秒完成 bootstrap/lint/test，三次全部产物 digest 一致；回执绑定同一输入，所有 OPEN 问题关闭且验证 PASS 后才将 F01 改为 ACCEPTED |

本报告不包含实现修复，`fix_tracking` 保留为空。建议先完成构建验证器与一期范围整改，再生成新的验收回执；在旧验证器上补一份绿灯无法关闭 A02。最终文档校验采用 `node scripts/check-development-plans.mjs`（不使用重置复审入口的 `--fresh-review`），并执行 `git diff --check`。

证据总入口：[summary.json](./evidence/F01-2026-09-17/summary.json)。SOURCE/MOCK 探针仅验证门禁行为；其假构建产物保留在临时目录并自动清理，没有写入真实 `artifacts/reproducibility`。
