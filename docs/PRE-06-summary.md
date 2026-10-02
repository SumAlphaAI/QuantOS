# PRE-06 Web 测试基线

> 日期：2026-10-02；版本：3.0；范围：一期官网与Web Terminal。
> 当前工程修复与验证见[整改验收记录](./audit/PRE-06-remediation-2026-10-02.md)及[证据清单](./audit/evidence/pre06-remediation-20261002/manifest.json)。2026-09-16结果是历史回执，不代表当前源码或远端验收。

## 1. 交付与门禁

| 基线 | 当前交付与验收 |
|---|---|
| BFF/MSW | 同源OpenAPI1.3.0、62操作/51schema；10个登记JSON（6契约正向、2明确负向、2隔离的PRE-04 inventory正向），四resolver所有成功/错误分支受检，其余默认501；schema、不可执行不变量和规范化敏感字段拒绝 |
| CI结构 | 解析实际YAML步骤/条件/顺序，TS AST核对有效配置、契约断言及四个像素比较调用；注释不能冒充接线或断言 |
| 浏览器/axe | 官网与Terminal各三project，1440×900、390px与200%缩放、键盘及serious/critical axe阻断；CI `failOnFlakyTests`拒绝重试后通过 |
| 视觉 | Linux/macOS各12张、合计24PNG；hash/尺寸/inventory、0.5%阈值和真实篡改负向；缺图失败，不无条件跳过或自动批准 |
| 性能 | 两应用CI均查共享JS≤250KB、chunk≤200KB、CSS≤60KB及每路由≤200KB；完整资源和源码/配置/构建身份必须有效 |
| 覆盖率 | 全局TS行≥80%；五个关键风险政策文件独立逐文件行/语句/函数/分支100%，包括风险提示TSX |
| 失败证据 | 应用隔离的JSON与test-results（trace、图片、上下文）归入artifacts/browser；两workflow均always上传，保留14天 |

范围与隔离决定见[工程ADR](./adr/20261002-pre06-fixture-and-critical-baseline.md)。生成操作数量不等于所有业务mock/provider验收；新增fixture、关键逻辑、平台或预算须同步模型与回归。

## 2. 操作

`pnpm check:pre06`检查实际接线、配置和fixture；`pnpm test:pre06`执行结构、集合破坏、空产物和真实flaky政策探针；`pnpm test:contract`先检查结构，再执行17项contract；`pnpm sabotage:pre06`重放schema、权限、敏感字段、真实PNG破坏。

完成显式环境构建后，`pnpm check:perf apps/terminal/out`和`pnpm check:perf apps/website/out`均须通过。`pnpm coverage:web`包含全局80%与独立关键100%；`pnpm coverage:critical`可单独重放，覆盖报告位于coverage/critical。浏览器使用对应配置和相同环境构建产物；常规验证使用`--update-snapshots=none`，不将更新模式计为通过证明。

## 3. 当前证据与边界

本轮按当前Git基线叠加修复、冻结离线依赖，以macOS本地CI mock配置重放；完整命令、测试数量、构建指标和源码SHA-256绑定见整改记录。本地生成与核对macOS缺图后另行重放；原Linux和macOS17张基线未改写。

[2026-09-16回执](./audit/PRE-06-acceptance-evidence-2026-09-16.md)保留其历史SHA及跳过结论。当前三浏览器不继承旧“有跳过PASS”；Linux只可先证明12张基线完整，当前Linux执行/远端CI仍需独立回执。

正式G0、指定模型复审、风险/QA/设计owner签署、staging/provider/BFF/IdP/Sentry/账号、数据库、全业务与Desktop/native保持独立 **NOT RUN / NO RECEIPT**。本轮未连接数据库，也不提前宣称后续页面任务全部通过。
