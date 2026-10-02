# P0 / PRE-03「技术栈落地」全面复审报告

> 再复验日期：2026-10-02（Asia/Shanghai）
> 基线：Git `eaa294120ab2b62dfaa211c7dd3f9901fdb46738` 加本次补充修复；前端执行计划 v3.6。
> 当前结论：**PASS（一期 Web 仓库工程验收范围）**。原 10 项问题全部关闭；当前阻塞级、高危、中危、低危均为 **0**。

## 一、任务完成概况

依据[前端开发执行计划](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md) §1.1、§1.3、§2、PRE-03、§7、§9，以及[运行时 ADR](../adr/20260814-pre03-runtime-stack.md)，逐项核对全部 10 项问题的实现、门禁、文档与实际运行证据。

本轮发现并补齐两处首轮整改遗漏：依赖检查独立发现 workspace 清单并验证完整 importer、准确链接目标与 overrides；按应用隔离加载 Next 有效配置，使 `.env.local` 与注入环境变量的构建回执一致，避免应用间环境缓存污染。干净重放和破坏检查通过后，确认原问题全部关闭。

已解决问题的详细描述移出主报告。追溯入口：[初审及首轮状态历史](./PRE-03-comprehensive-review-history-2026-10-02.md)、[首轮整改记录](./PRE-03-remediation-2026-10-02.md)、[本轮逐项关闭记录](./evidence/pre03-recheck-20261002/closure.json)。

| 统计口径 | 当前结果 |
|---|---:|
| PRE-03 仓库工程验收 | 1/1，100% |
| 必需主产物（ADR、依赖锁、最小 Web 构建与 smoke） | 3/3，100% |
| 独立控制点 | 15/15 PASS，100% |
| 原问题关闭 | 10/10，100% |
| 当前未解决问题 | 0 |

完成率沿用初审 15 个等权控制点，PARTIAL 与 FAIL 均为 0；不表示后续业务页面、所有依赖的业务接线或正式 G0 已完成。

## 二、完成情况明细统计

| 控制点 | 当前实现与复验结果 | 结果 |
|---|---|---|
| C01 工具链与一期 workspace | Node 24.12.0、pnpm 10.20.0；官网、Terminal 与 packages 的显式范围受检 | PASS |
| C02 目标技术栈 | 29 项关键依赖锁定；React Testing Library 16.3.0、jsdom 26.1.0 已直接声明并用于组件交互测试 | PASS |
| C03 可冻结安装的依赖锁 | 干净副本 frozen/offline 安装、前端锁检查通过 | PASS |
| C04 运行时 ADR | Next 15.5.24 等现行版本与一期范围一致；版本漂移可拒绝 | PASS |
| C05 官网 PoC | Next App Router 静态构建；首页和七个首期页面浏览器检查通过 | PASS |
| C06 Terminal PoC | 静态构建；`/command` 守卫放行、共享壳渲染；保留禁止索引设置 | PASS |
| C07 开发规范 | 全 workspace lint/typecheck 通过；Next 专项规则负向样例被拒绝 | PASS |
| C08 单元测试与组件文档 | 25 个测试文件、177 项测试通过；Storybook 静态构建通过 | PASS |
| C09 目标路由 | 两个路由 smoke、3 项目标 Chromium 用例通过 | PASS |
| C10 路由 smoke 可靠性 | 检查 JS/CSS HTTP、可见页面标记及脚本错误；坏资源、伪 HTML、错误脚本等负向输入被拒绝 | PASS |
| C11 配置及构建关联 | 读取有效 Next 配置；拒绝注释/死分支/覆盖伪装；逐应用绑定源码、公开 profile、实际输出模式与 build ID | PASS |
| C12 依赖 Gate | 独立发现 manifest；全 importer、精确 workspace 链接、overrides、声明与解析图一致性受检 | PASS |
| C13 计划与 CI 接线 | 当前计划与 22 项回归通过；workflow 在构建后安装 Chromium 并调用 PRE-03 正负 Gate | PASS |
| C14 新环境时限 | 干净源副本，复用下载缓存；bootstrap/lint/typecheck/test/build 共 32.278 秒，满足 ≤30 分钟 | PASS |
| C15 标准运行入口 | 两应用实际 `start` 与浏览器打开通过；未知路由和缺失资源均返回真实 404 | PASS |

### 本轮执行证据

在临时 Git archive 副本覆盖本次修改；开始时无依赖、构建及测试产物，复用宿主 pnpm 下载缓存。仅将仓库公开 local-mock 示例复制至两个应用 `.env.local`，不注入 `NEXT_PUBLIC_*`，固定构建 `GITHUB_SHA` 为基线。16 条主检查命令全部退出 0，合计 **60.932 秒**。该耗时不含补充标准启动与 profile 检查。

| 验证组 | 结果 |
|---|---|
| 安装、lint、类型检查、Web 构建、Storybook | 全部通过 |
| PRE-03 Web Gate | 29 项锁定依赖、2346 项运行时检查、2 项构建路由通过 |
| PRE-03 Web 正负套件 | 27/27 通过（包含一个测试内的多种破坏输入） |
| Desktop 显式参考套件 | 4/4 通过；不等于原生构建/安装验收 |
| 单元测试 | 177/177，含 UI 19/19 |
| 计划正向及回归 | 通过，22/22 |
| PRE-02 正向及回归 | 通过，27/27 |
| Chromium 目标用例 | 3/3 通过 |
| 标准 start / 404 / 删除 Desktop 后 Web Gate | 全部通过 |
| 公开 profile 绑定 | `.env.local` 与相同注入配置均通过；修改文件或注入值而不重建均被拒绝 |

[证据清单](./evidence/pre03-recheck-20261002/manifest.json)保留输入与日志摘要；[主检查](./evidence/pre03-recheck-20261002/clean-run.json)、[源码与构建回执](./evidence/pre03-recheck-20261002/source.json)、[标准启动](./evidence/pre03-recheck-20261002/start-browser.json)、[profile 探针](./evidence/pre03-recheck-20261002/profile-check.json)可独立追溯。构建 ID 中的 SHA 表示归档基线，覆盖修复后的实际源码由 `sourceDigest` 和文件 SHA-256 绑定，不冒称已存在的最终提交构建。

## 三、当前问题清单及风险边界

| 优先级 | 未解决数量 |
|---|---:|
| 阻塞级 | 0 |
| 高危 | 0 |
| 中危 | 0 |
| 低危 | 0 |

目前没有需继续整改的 PRE-03 仓库问题。以下保留验收边界，不列作已解决问题：

- GitHub 实际 CI、正式 G0 联合签署、指定模型、provider/staging、Firefox/WebKit、空下载缓存首次联网安装均 **NOT RUN / NO RECEIPT**。CI 接线及本地重放不替代远端运行回执。
- 本轮没有数据库执行、Desktop/native 构建或完整 F01 跨语言验收；PRE-02 只重放其正负 Gate，未重做其全部浏览器视觉与辅助技术验收。
- 技术栈安装与最小 Web PoC 不替代后续 Query、图表、表单、国际化、BFF 和实时业务验收。浏览器结果只覆盖本报告列出的目标路由与用例。
- 构建存在已知第三方警告，当前构建、类型与目标浏览器均通过；未无条件批准依赖安装脚本，也未将这些结果外推为全量页面质量结论。

## 四、维护建议与后续验收

当前无待执行整改项。变更运行时版本、workspace、Next 配置或公开环境 profile 后，重新安装/构建并重放正负 Gate；不得复用旧源码摘要或不同 profile 的回执。默认入口继续限定一期 Web，Desktop 仅通过显式二期入口核验。

发布或阶段放行时，另行取得相应提交的远端 CI 与正式验收回执。当前报告、执行计划和[PRE-03 总结](../PRE-03-summary.md)保持一致；历史报告及原始证据保留历史身份。

复验入口：[replay.py](./evidence/pre03-recheck-20261002/replay.py) 与 [profile-check.py](./evidence/pre03-recheck-20261002/profile-check.py)。前者归档运行时 HEAD 并覆盖工作区修改，在新临时目录执行；后者使用该次临时目录并恢复变更的示例配置。需要 Node/pnpm、现有下载缓存与 Chromium；重放前复制证据目录，避免覆盖已归档结果。工具链路径记录在脚本中，无数据库、部署或发布操作。
