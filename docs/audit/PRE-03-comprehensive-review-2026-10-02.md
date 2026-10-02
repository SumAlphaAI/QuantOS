# PRE-03 技术栈落地全面复审报告

> 检查日期：2026-10-02  
> 依据：前端开发执行计划 v3.4，§1.1、§1.3、§2、§3.1 PRE-03、§7、§9  
> 源码基线：`695c5f021aaa702f94fb82b1a17314ba8df182bd`；检查开始时工作区干净  
> 范围：P0 / PRE-03，一期官网与 Web Terminal 的技术栈、运行时 ADR、锁文件、最小构建、路由与验收门禁  
> 证据：[manifest.json](./evidence/pre03-review-20261002/manifest.json)；所有命令、退出码、时间和破坏探针随报告入库

## 当前整改状态

2026-10-02 已完成原10项问题的仓库整改，当前15/15控制点通过，活动问题0。详见[整改与验证记录](./PRE-03-remediation-2026-10-02.md)和[最终证据清单](./evidence/pre03-remediation-20261002/manifest.json)。远端CI、正式G0、指定模型与provider/staging仍未执行。

**下列四部分保留初审历史：46.67%完成率及10项发现描述的是修复前基线，不是当前未解决问题。**

## 一、初审任务完成概况

**结论：Web PoC 可构建、可打开，当前 PRE-03 工程验收不应整体放行，建议整改后复审。** 计划中的 `development_status: COMPLETED` 是已有开发状态，不能替代本次验收结论。本次未修改该状态或源代码。

15 个独立控制点中，完全完成 7 项、部分完成 7 项、未完成 1 项。严格完成率为 **7 / 15 = 46.67%**；辅助进度率按 PASS=1、PARTIAL=0.5、FAIL=0 计算为 **70.00%**。后者不是验收通过率，也不表示已交付 70% 的业务页面。控制点均等权重，不使用已有 `COMPLETED` 标记推算完成度。

发现 **10 项活动问题：阻塞级 1、高危 2、中危 6、低危 1**。阻塞项发生在 CI 前置计划结构校验；两项高危是运行时配置和构建路由门禁的误放行。当前正常产物运行通过，不据此推断这些误放行已在生产发生。

### 1.1 本次实际执行与证据边界

从上述提交创建临时干净 Git archive 副本，无 `.git`、`node_modules`、`.next`、`out`、Storybook 产物或 TypeScript 构建缓存。使用 macOS、Node 24.12.0、pnpm 10.20.0；复用宿主 pnpm 下载缓存，显式注入仓库 `env/local-mock.env.example`，不包含生产凭据。构建 SHA 通过 `GITHUB_SHA` 固定。

- frozen 离线安装、全 workspace lint/typecheck/test/build 全部退出 0；24 个测试文件、176 项单元测试通过。
- 官网与 Terminal 分应用静态构建通过：构建日志分别显示 12、17 个静态生成页面；路由表分别为 10、15 行，包含元数据/保留路由，不等同于业务页数量。Storybook 静态构建通过。
- PRE-03 Web 门禁通过：26 项锁定依赖、35 项运行时检查、2 项构建路由检查；现有 PRE-03 测试 8/8 通过（其中 1 项当前契约、7 项负向用例）。
- Chromium 3/3 用例通过：Terminal `/command` 守卫放行与共享壳渲染；官网首页；官网七个首期页面可访问及导航互链。
- PRE-02 正向 Gate 与前端 manifest/锁一致性检查通过；计划结构校验退出 1。
- Web bootstrap + lint + typecheck + test + build 合计 **29.166 秒**；加入 Storybook、PRE-03 正负检查、PRE-02 与计划检查的整段执行耗时 **34.083 秒**，其中计划检查失败。新环境时限在“缓存可用、工具链已就绪、正确 local-mock profile”的条件下通过，不能把整段执行称作全绿。

完全空下载缓存的首次联网安装、GitHub Actions 实际运行、Firefox/WebKit、provider/staging、正式 G0 和指定模型验收均 **NOT RUN**。本次不运行数据库；Desktop/native 属二期范围，不作为一期缺陷或完成率分母。PRE-02/F01 是依赖输入：本次重放 PRE-02 正向 Gate、读取 F01 当前验收记录并检查前端锁，未重跑 F01 的 Rust/Python、三次构建或完整跨语言验收。

## 二、初审完成情况明细统计

### 2.1 逐项验收矩阵

| 编号 | 核对项及依据 | 当前证据 / 缺口 | 结果 | 关联问题 |
|---|---|---|---|---|
| C01 | 固定 Node/pnpm，保留现有一期 workspace（§2） | `.nvmrc=24.12.0`、`packageManager=pnpm@10.20.0`；实际版本一致；workspace 仅官网、Terminal、packages | PASS | — |
| C02 | 引入目标技术栈（§2、PRE-03 主要动作） | 26 项目标依赖锁定且安装成功；明确选定的 React Testing Library 未声明或锁定 | PARTIAL | M-05 |
| C03 | 依赖锁可用于冻结安装（PRE-03 产出） | 干净副本 frozen/offline 安装及 `check-node-lock.mjs` 均通过 | PASS | — |
| C04 | 运行时 ADR 与现行版本/一期范围一致（§2、PRE-03 产出） | ADR 存在，但 Next 15.5.23 已过时，仍以双端加载/桌面检查作为当前验收口径 | PARTIAL | M-01、M-02 |
| C05 | 官网 Next.js App Router PoC 与独立构建 | 当前版本独立静态导出成功；首页、七页访问与导航实际浏览器通过 | PASS | — |
| C06 | Web Terminal Next.js App Router PoC | 静态导出成功；`/command` 浏览器渲染共享壳；layout 设置 `noindex, nofollow` | PASS | — |
| C07 | 开发规范、lint 与类型检查（§2、§7） | 全 workspace lint/typecheck 通过；Next 专项 ESLint 插件未启用，构建两次明确警告 | PARTIAL | L-01 |
| C08 | 自动化单元测试与组件文档运行时 | 176 项 workspace 单元测试通过；Storybook 可构建；不外推为完整页面/组件验收 | PASS | — |
| C09 | 官网与 Web Terminal 目标路由可打开（完成标准） | 隔离构建产物 HTTP smoke 与 Chromium 3 项目标用例通过 | PASS | — |
| C10 | 路由 smoke 能拒绝不可用产物（产出、测试验收） | 缺失路由正确 FAIL；无业务页面、缺失 JS 资源的伪 HTML 却 PASS | PARTIAL | H-02 |
| C11 | 运行时配置验证有效（主要动作、§2） | 当前静态导出有效；注释标记/运行时覆盖为 standalone 的配置仍被接受 | PARTIAL | H-01 |
| C12 | PRE-03 锁依赖 Gate 可失败关闭 | importer 版本漂移可拒绝；manifest 漂移、packages/snapshots 清空未被发现；安装步骤是独立补防 | PARTIAL | M-04 |
| C13 | CI 前置检查及正负验收接线（§7、§9） | 前置计划校验确定失败，无法到达构建/smoke；全部 workflow 未调用 PRE-03 负向测试 | FAIL | B-01、M-03 |
| C14 | 新环境 ≤30 分钟 bootstrap/build/test | 干净副本、既有下载缓存与正确 profile 下 Web 主链 29.166 秒；边界见 §1.1 | PASS | — |
| C15 | 最小构建具备有效的标准启动入口 | 静态服务器能运行；两个应用的 `start` 命令均退出 1 | PARTIAL | M-06 |

| 状态 | 项数 | 占比 |
|---|---:|---:|
| PASS（完全完成） | 7 | 46.67% |
| PARTIAL（已有实现但验收存在缺口） | 7 | 46.67% |
| FAIL（未完成） | 1 | 6.67% |
| 合计 | 15 | 100%（分项四舍五入有误差） |

### 2.2 技术选型覆盖核对

| 技术组 | 实际锁定基线与观察 | 结论 |
|---|---|---|
| 框架、类型与构建 | Next 15.5.24、React/React DOM 19.2.8、TypeScript 5.9.2、Node 24.12.0、pnpm 10.20.0 | 安装、类型检查与实际 Web 构建通过；ADR 版本待同步 |
| 样式、UI、组件文档 | Tailwind/PostCSS 4.3.3、Radix Dialog 1.1.23/Tabs 1.1.21、Storybook 8.6.18/Vite 6.4.3 | 安装及构建通过，PRE-02 正向基线通过 |
| 查询、状态、表格、图表 | Query 5.101.4、Zustand 5.0.15、Table 8.21.3/Virtual 3.14.9、ECharts 6.1.0/Lightweight Charts 5.2.1 | 依赖已安装/锁定；不将安装记作全量业务接线完成，后续页面任务负责业务验证 |
| 表单、国际化、mock | React Hook Form 7.85.0、Zod 4.4.3、next-intl 4.13.6、MSW 2.15.0 | 依赖已安装/锁定；中文安全文案及 fixture 沿用 PRE-02/PRE-06 边界 |
| 测试栈 | Vitest 4.1.11、Playwright 1.62.1、axe 4.13.0 已锁定；无 `@testing-library/react` | 测试栈选型落实不完整，DOM/user-event 传递依赖不能替代 React Testing Library |
| 契约、实时、观测 | 既有生成客户端/Proto 与后续 BFF/PRE-06 任务承接；profile 将观测关闭 | PRE-03 只验证基础运行时，不要求在本轮补完 provider、SSE/WS 或隐私策略批准后的观测启用 |

### 2.3 命令结果与独立破坏检查

正向命令及耗时见 [clean-run.json](./evidence/pre03-review-20261002/clean-run.json)；浏览器、启动和锁检查见 [supplemental.json](./evidence/pre03-review-20261002/supplemental.json)。原 2026-09-16 证据属于其记录的历史 SHA，不用于充当当前测试数、版本或 CI 结果。

[独立探针](./evidence/pre03-review-20261002/probes.json)记录以下结果；探针只修改临时副本/内存输入，不修改仓库源码：

| 输入变化 | 期望 | 实际 | 判断 |
|---|---|---|---|
| 当前 Web 契约 | PASS | PASS | 当前正向基线有效 |
| 仅注释包含 `output: "export"`，实际导出 standalone | FAIL | PASS | 漏检 |
| 先定义 export，随后覆盖为 standalone | FAIL | PASS | 漏检 |
| 清空 pnpm packages/snapshots，保留 importer 版本 | FAIL | PASS | 漏检 |
| Terminal package.json 的 Next 改为 16.0.0，锁文件不变 | FAIL | PASS | 漏检（独立 frozen install 可补防） |
| 两个 out 页面仅保留 marker，引用不存在的 JS | FAIL | PASS（2 路由） | 漏检 |
| 删除 Terminal `/command` HTML | FAIL | FAIL（404） | 正确拒绝 |
| Web-only 输入的根 Rust pin 漂移 | FAIL（现有脚本契约） | FAIL | 根工具链检查有效；不等于桌面验收 |

## 三、初审问题清单及风险分析（已整改）

### 3.1 严重程度与完整活动清单

阻塞级表示当前必经验收流程确定无法继续；高危表示门禁会将关键错误条件误判为可放行；中危表示文档、测试覆盖或运行入口存在工程缺口；低危表示专项开发规则覆盖不足但当前基本构建正常。

| ID / 优先级 | 所属模块 | 具体表现与复核依据 | 影响范围 / 风险 |
|---|---|---|---|
| **B-01 / 阻塞级** | 执行计划 / 计划校验 / Frontend Baseline CI | 当前副本及原仓库运行 `check-development-plans.mjs` 均报 `PRE-01: missing review_entry`。PRE-03 同样缺少 `review_entry` 与复审字段；计划 §9 仍要求这些字段，validator 第106行也强制要求。workflow 第45–46行将它置于构建前。证据：`plan.log` | 一期 frontend-baseline 必经 job 在到达 PRE-03 构建/路由验收前即失败；本次是本地重放证明，未声称远端实际 run 已失败。属于跨任务流程阻塞，不是 Web PoC 无法构建 |
| **H-01 / 高危** | PRE-03 运行时配置 Gate | `pre03-smoke.mjs:77–78` 只用文本 includes 判断 export；注释标记与后续赋值覆盖均 PASS，未读取最终有效配置 | 两个应用的静态导出决策可失效而独立 Gate 继续放行；若复用已有 out，不能证明该 out 来自当前配置 |
| **H-02 / 高危** | PRE-03 构建路由 smoke | `checkPage` 仅要求 HTTP 200 和字符串 marker；伪 `/command` 与官网首页无应用内容、引用缺失 JS，`runPre03` 仍 PASS。证据：`empty-page-missing-chunks` | 页面无法 hydration/交互或不是有效应用时仍被标记“目标路由可打开”；独立 smoke 回执可信度不足。现有 Chromium 用例可发现部分此类故障，但不使 smoke 本身有效 |
| **M-01 / 中危** | 运行时 ADR / 版本变更治理 | ADR 第18行仍冻结 Next 15.5.23；实际 manifest、锁文件、构建和 Gate 都是 15.5.24。ADR 第31行明确版本替换必须更新 ADR | 当前实际版本与已批准决策不一致，技术栈变更追溯及后续按文档重建存在歧义 |
| **M-02 / 中危** | PRE-03 范围、文档与默认入口 | 当前计划一期 Web-only；ADR/summary 仍要求双端共享产物、Tauri/深链，root `check:pre03`/`smoke:pre03` 和 `test:pre03` 默认加载 Desktop 文件。Web CI 已选择 `check:pre03:web`，但文档引导默认双端命令 | 开发者/审核者会把二期范围误作一期前置要求；正常二期配置变化可能使一期默认自检失败。根 Rust pin 本身归 F01，不将其误归原生缺陷 |
| **M-03 / 中危** | PRE-03 负向测试 / CI | 搜索全部 `.github/workflows` 仅发现 `check:pre03:web`，没有 `test:pre03` 或该负向文件调用；ADR/summary 却声称正负 Gate 同时接入 CI。当前 8 项测试也未覆盖配置语义、坏资源与 Web-only 隔离 | 即使 B-01 修复，负向回归仍不在自动必经流程中，门禁退化无法及时发现 |
| **M-04 / 中危** | PRE-03 锁文件/依赖验证 | `loadRuntimeInputs` 不读取三个 importer 的 package.json；验证仅比较 importer.version；manifest 漂移与 packages/snapshots 清空均 PASS | standalone PRE-03 回执不能证明声明/锁一致或解析图完整；frozen install 和 F01 `check-node-lock` 当前可补防，因此未上升为全工程依赖失锁高危 |
| **M-05 / 中危** | 目标测试技术栈 | 执行计划 §2 明确 Vitest + React Testing Library；所有一期 package manifests 和锁文件均无 `@testing-library/react`。Storybook 的 DOM/jest-dom/user-event 传递依赖不是该 React 库 | 目标测试栈未完整落地，后续组件状态与交互测试缺少计划选定的标准接口。已有 176 项测试通过不代表这个缺口关闭 |
| **M-06 / 中危** | 官网 / Terminal 运行入口 | 两个 package.json 的 `start` 都执行 `next start`；干净构建后实际执行均退出1，提示不能用于 `output: export`。证据：`website-start.log`、`terminal-start.log` | 标准 build → start 预览路径不可用，新成员/部署脚本易误用；独立静态服务和当前浏览器测试可正常运行，未将其认定为所有启动方式失效 |
| **L-01 / 低危** | Next 开发规范 / ESLint | 根 ESLint 仅注册 JS/TypeScript 推荐规则；两个 Next 构建均警告 Next plugin 未检出，未接入 Next 专项 lint 规则 | lint 全绿不能证明遵守框架专项约束；当前未发现因此造成的运行错误，属于规则覆盖缺口 |

### 3.2 风险边界与已验证事实

1. **正常产物可用与 Gate 可靠性须分开。** 本次实际 Web 构建和目标 Chromium 路由通过；H-01/H-02 是错误输入下的误放行。无法用正向测试数量抵消可重复的负向漏检。
2. **CI 风险是当前源码即可触发的阻塞。** B-01 不依赖网络或目标后端；其他后续 CI 步骤是否通过尚未执行。M-03 是另一项独立接线遗漏，不能仅修计划字段就关闭。
3. **版本与阶段漂移已发生。** 当前 ADR/summary 不再准确描述一期版本与 Gate；保留历史证据是正确做法，但必须标清历史而非当前验收入口。
4. **时限与集成验收具有边界。** 29.166 秒只证明本机干净 Web workspace 在可用下载缓存条件下的链路；不证明首次网络安装、production/staging、完整业务接线或正式 G0。
5. **已知非阻断输出。** pnpm 提示部分依赖 build scripts 未获批准；Storybook 有 `use client`/source map、第三方 eval、大 chunk 与子进程弃用警告。本次实际构建、目标浏览器及单元测试通过，未发现足以另列缺陷的实际失败；不能据此无条件批准全部依赖脚本或扩大为全量页面验收。

## 四、初审整改建议（执行结果见整改记录）

按 B → H → M → L 顺序执行；每项都应有对应的可重复关闭证据。下列角色为建议责任人，不表示已经得到签署。

| 顺序 / 问题 | 建议责任人 | 整改动作 | 关闭标准 |
|---|---|---|---|
| 1 / B-01 | FE TL / 计划维护者 | 对齐当前计划复审流程、§9/schema、validator 和 CI；按当前约定补齐必要任务元数据，或若已有正式流程变更则同步 schema/校验，不以删除前置检查掩盖失败 | 当前主计划与 Desktop 计划结构检查通过；计划负向测试仍能拒绝不合法字段/依赖；绑定新 SHA 的本地结果及实际 CI 回执分别记录 |
| 2 / H-01 | FE TL | 验证最终生效的 Next 配置，覆盖注释、死分支、后续覆盖；避免用字符串存在性当配置决策；配置验证与本次构建产物建立关联 | 当前配置 PASS；仅注释、standalone、覆盖 export 为其他值的探针 FAIL；重新构建后静态输出与配置一致 |
| 3 / H-02 | FE TL / QA | smoke 检查引用的必要 JS/CSS 可获取，增加浏览器渲染/守卫到达关键标记验证；构建产物与源码 SHA 关联 | 缺失 chunk、伪 marker 空页、404、hydration 失败均 FAIL；新建官网 `/` 与 Terminal `/command` 产物正常 PASS |
| 4 / M-01 | Architect | ADR 同步当前 Next 15.5.24，说明升级决定与实际锁定值；将 ADR 版本映射纳入一致性检查 | ADR、manifest、锁解析和 Gate 一致；再改变其中一份时检查 FAIL |
| 5 / M-02 | FE TL | PRE-03 当前总结/ADR 与默认入口采用一期 Web-only；Desktop 检查保留显式二期入口，历史证据继续独立保存 | 一期命令不加载 Desktop 工程文件；删除/破坏二期副本不影响一期 Gate；二期专用命令仍有效 |
| 6 / M-03 | QA / CI owner | 新增 Web-only PRE-03 负向套件并接入 frontend-baseline，涵盖本报告配置、坏资源、锁及阶段隔离探针；同步 CI 描述 | workflow 有实际调用；负向套件能发现上述错误；本地结果和真实 CI run 不混记 |
| 7 / M-04 | FE TL | PRE-03 复用前端冻结锁一致性检查，并验证目标 importer 对应包/快照；不要仅扩大硬编码版本名单 | manifest 改版、specifier 不一致、缺失 package/snapshot 均 FAIL；实际 frozen 安装及正常 Gate 通过 |
| 8 / M-05 | FE TL / QA | 补齐 React Testing Library 与适配测试环境；或通过明确 ADR/计划变更批准替代方案，不隐式用传递 DOM 库替代 | 选型声明与直接依赖一致；至少一项真实 React 组件状态/交互测试可执行，证明标准测试接口可用 |
| 9 / M-06 | FE TL | 为静态导出提供受控、固定版本/仓库内的预览入口，替换两个无效 `start`；保持官网与 Terminal 独立端口 | 干净安装/build/start 后实际浏览器可打开目标路由；未知路由保持真实404，避免单页回退伪成功 |
| 10 / L-01 | FE TL | 接入与当前 Next 版本兼容的专项 ESLint 规则，明确规则适用范围 | 构建不再出现插件缺失警告；选定的 Next 规则违规样例可失败关闭 |

复审退出条件：10 项逐一取得关闭证据，15 项控制点重新统计；在新源码 SHA 上重放干净 bootstrap/build/test、正负 Gate、两应用启动与目标浏览器 smoke。历史 2026-09-16 回执保留历史身份；新的结果应替代当前入口，但不得顺带宣称指定模型、正式 G0 或 provider/staging 验收完成。

### 4.1 证据文件与重放

- [证据清单与输入摘要](./evidence/pre03-review-20261002/manifest.json)：基线 SHA、文件 SHA-256、执行边界、完成率与问题数量。
- [隔离执行记录](./evidence/pre03-review-20261002/clean-run.json)：10 条命令的参数、退出码、耗时及完整日志。
- [浏览器/运行入口/锁检查记录](./evidence/pre03-review-20261002/supplemental.json)：5 条补充命令。
- [独立破坏探针及结果](./evidence/pre03-review-20261002/probes.mjs)、[probes.json](./evidence/pre03-review-20261002/probes.json)：验证现有 Gate 的误放行与正确拒绝。
- [干净重放脚本](./evidence/pre03-review-20261002/replay.py)、[补充检查脚本](./evidence/pre03-review-20261002/supplemental.py)：在仓库根运行；依赖已安装的 Python、Node/pnpm 与 Chromium，本次使用的 pnpm 路径明确写在脚本中。脚本不安装数据库、不部署、不发布。

`replay.py` 固定本报告原始 SHA，创建新的临时副本并更新同目录日志；重放前应保留本次原始证据，或复制证据目录再调整输出位置。修复后验收需要更新基线 SHA，不能继续用旧 SHA 的成功结果代替修复验证。本轮仅新增审计报告与证据，未修复问题、修改计划或创建 Git 提交。
