# FRONTEND-GATE:G0 整改与复验报告（2026-10-05）

## 一、任务完成概况

依据 [原全面复审报告](./FRONTEND-GATE-G0-comprehensive-review-2026-10-05.md) 的 B-01、M-01～M-04 顺序完成工程整改。原报告和原反证文件保持原样；本报告记录当前修复结果，历史失效现象不能当成当前未修复状态。

最终工程受检源码：`22254ddaba32946e33c6be0c63f277229a0331b9`。工程整改已完成；G0 DEVELOPMENT 为 **BLOCKED**，仅缺 **M-01 当前六方契约/功能范围确认**。用户已明确“暂无，先完成工程整改”，因此没有生成组织确认、复用 2026-08-14 历史签署或手工登记 READY。正式 G0/staging/联合发布签署仍属于 RELEASE。

当前必要控制点 **23/24（95.83%）** 通过，1 项 MISSING；工程控制点 **23/23（100%）**。原 5 项发现中，4 项工程缺口关闭，1 项组织记录待补，问题关闭率 **80%**。B-01 的验收机制缺口已关闭，但不能据此跳过 M-01 放行 G0。

## 二、完成情况明细统计

| 原问题 | 模块 | 工程修复与实际复验 | 当前结果 |
|---|---|---|---|
| B-01（阻塞） | G0 聚合门禁 / CI | 新增受维护 policy、功能输入清单/摘要、16 项实际执行日志、Web 构建来源、3 个直接依赖及其 14 节点递归回执、scope 请求与残留项；执行中源码/计划漂移在发布前拒绝；持续负向进入 CI，Proto 显式绑定受检源码父提交的完整 SHA | 工程缺口 CLOSED；整体 G0 因 M-01 BLOCKED |
| M-01（中危） | 当前组织范围确认 | 固定六角色及当前输入摘要；增加真实原始记录路径、摘要、身份/授权、时间、阶段与决定的一致性校验；严格拒绝历史记录、缺角色、错来源或假 READY | PENDING，六方当前记录均缺 |
| M-02（中危） | 遗留治理 | 保留历史十项和 9 项当时逾期事实，拆为当前 19 子项；明确工作阶段、owner、检查点期限、消费条件、非空兼容策略及来源；当前文字/JSON 对齐，期限核对目标任务实际阶段 | CLOSED（治理整改；没有关闭未来交付） |
| M-03（中危） | PRE-01 API 登记 | 当前版与 18 个含 published 操作行的 API/mock 版同步 1.5.0；6 个仅 planned 行保持未生成；最后仓库验证日期更新；纠正正式 G0/staging 提前阻断开发/Integrated 的说法 | CLOSED |
| M-04（中危） | 生产导入边界 | 默认 InMemory 组装迁到 tests/fixtures；生产显式注入 client。四类旧 backend/接口、旧 client 的运行时工厂、内部模块及数据库/venue SDK 被拒绝；覆盖应用和共享前端包、别名/重导出/namespace/dynamic/require、JS/JSX/MJS/CJS；生产不接受 inline disable。测试与注册 Storybook fixture 例外明确 | CLOSED |

十九个遗留子项分为 5 个 IMPLEMENTED_ENGINEERING、10 个 PENDING、4 个 DEFERRED。IMPLEMENTED_ENGINEERING 仅指引用已有工程实现与执行门禁，不把历史整项、未来 provider、发布或二期验收改为 CLOSED。检查点是工程消费期限，不冒充 owner 签署的新日历承诺；FEP-1 设计须在页面进入 Sprint 前补齐，其 INTEGRATION 检查点只是外层期限。

| 验证层 | 实际结果 | 边界 |
|---|---|---|
| 最终源码专项回归 | 166/166，0 failed / 0 skipped | PRE-01、历史/当前治理、生产导入、G0 负向、上游回执回归 |
| 最终上游完整轮 | 65/65 PASS，14 节点内容绑定 READY | 包括 3 次独立构建、Rust/Python/Web、Proto、契约、覆盖率、语义 mutation、浏览器与 Supabase 功能执行 |
| G0 本身 | 16/16 PASS，engineering PASS / stage BLOCKED | 静态、fixture/mock、Chromium 与 loopback SSE；本身不执行数据库 |
| Web/OIDC callback | Chromium 11/11 PASS | 当前源码重新构建；mock IdP / route 拦截，包含布局、a11y 和视觉 |
| SSE | 7/7 PASS | 包括真实 loopback HTTP 断流/续传、去重、gap、撤权；不冒充部署环境 |
| Supabase | F06 7 项、F05 1 万事件链、Storage、RLS 实际执行通过 | 工程已配置 Supabase + 本地受测服务；没有安装或启动本机 PostgreSQL/Supabase/Docker 数据库环境 |
| 严格 G0 准入 | 预期返回非零，缺六方范围确认 | 拒绝与 BLOCKED 一致，不能按工程 PASS 进入新页面开发 |
| 完整发布验收 | NOT RUN / NO CURRENT RECEIPT | 正式 staging/真实 IdP、组织发布签署、远程同 SHA CI、完整平台矩阵、性能/长稳仍按 RELEASE |

完整 24 项当前控制矩阵、实际执行项及日志见 [本轮证据目录](./evidence/frontend-g0-remediation-20261005/README.md)。

## 三、问题清单及风险分析

当前剩余 **0 项工程阻塞缺口、0 高危、1 中危、0 低危**：M-01，所属组织范围确认模块。没有 Product、Frontend、BFF、QA、Security、Risk 针对当前 1.5.0、一期 Web、planned 排除、PoC、当前输入及遗留处置的真实确认记录。

影响范围为 G0 的 DEVELOPMENT READY 及依赖它的新页面准入。CI 的 `check:g0-engineering` 会核对完整工程回执和 BLOCKED 一致性；`check:g0-development` 仍严格拒绝，不能把 CI 工程绿色解释为 G0 READY。新页面还须独立满足 PROVIDER:ALL；本轮不放行完整 API、全量业务联调、生产交易或发布。

历史十项仍以原范围保留；Backtest SSE、C02/C12～C16 等未来子项、正式 IdP/平台/发布性能和 Desktop 二期没有被自动验收。源码、契约、配置、测试、scope 记录或依赖摘要变化会使相应回执失效，需复评，不能只改 status/input_digest。

本轮初版源码 `9b65098` 与阶段/导入边界修订源码 `090e5c9` 各完成独立 65 项复验。随后 G0 实际执行发现 Git 状态空白解析、BFF CLI 标记及 CI Proto 基线配置缺陷，增加真实 CLI 和状态解析回归，形成最终受检源码 `22254ddaba32946e33c6be0c63f277229a0331b9`，再次完整复验上游及 G0。三轮日志与 artifact 分开保存；前两轮保留为历史快照，失败入口及已执行的六项命令原始日志另行归档，不作为修正后源码的当前 READY 依据。阶段回执按功能输入内容有效性消费；不宣称最终报告提交获得新的正式同 SHA 验收或 hosted CI。

## 四、整改建议与后续准入

1. 六方审阅 `scope:g0-development` 输出的当前范围请求，确认当前版本、最低冻结面、planned/RELEASE/二期排除及遗留处置。记录真实身份、授权、时间和来源，不以本次修复授权替代六方确认。
2. 将真实记录按 [G0 DEVELOPMENT 验收规程](../gate-records/G0-development-acceptance.md) 填入 `G0-current-scope-confirmations.json`，绑定当前 scopeDigest。输入变化后重新生成请求并审阅，不能粘贴旧摘要。
3. 重评受影响上游并执行 `pnpm assess:g0-development`；随后 `pnpm check:g0-development` 必须返回 READY，才完成 G0 阶段准入。正式 RELEASE 签署不提前到当前开发阶段。
4. 后续各 owner 按 [19 个当前遗留子项](../gate-records/G0-current-disposition.md) 的消费边界补证；计划继续独立验证 PROVIDER:ALL 和各 INTEGRATION/RELEASE 门禁。

本轮 Git 提交只包含工程整改、受维护负向、CI/计划/治理同步与实际复验回执。没有推送、生成正式 Git notes、外发确认请求或伪造组织批准。
