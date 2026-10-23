# FE:UI-501 交付报告

任务：I4 Portfolio 与 Risk。本次仅修改 QuantOS，直接在 main 开发和本地提交；未读取生产凭据、推送或部署。

源码候选：`6a3bd2de971a0037fe2c0ee6904dda98f475e616`；来源基线 `13c2a5c4`。实现提交 `040bf46a`，首轮修复 `14b8d335`，最终修复/源码冻结 `6a3bd2de`。最终证据提交在上述源码之上，仅封存结果和交付文档，不把最终提交 SHA 冒充已构建源码。完整变更清单在 changed-files.txt。

## 变更文件与行为

- `apps/terminal/app/portfolio/{page.tsx,workspace.tsx,workspace.css}`、`app/risk/page.tsx`：实际路由、授权 shell、常驻 Kill 状态、组合事实、风险命中、告警与危险操作表单，固定无障碍名称、主题/响应布局、状态清除和显式恢复。
- `apps/terminal/src/portfolio/{policy.ts,runtime.ts}`：生成 C01/C06/C16，账户与上下文/到期校验、精确十进制/九位 MoneyValue、同帧组合风险投影、密集 journal/版本回退拒绝、60s 快照/8s 核验期限、未知状态禁写、一次性 step-up/CSRF、原幂等键和原请求显式恢复，独立回执与当前事实。
- `apps/terminal/src/command/presentation.ts`：execution.operate 的 Portfolio 读导航别名，目标页面仍重新授权。
- `apps/terminal/tests/ui501{,-provider-consumer}.test.ts`：41 个当前功能用例和1个实际参考组合场景；其余6个直接相关测试文件合计69项，整个 Vitest 矩阵111项（准确文件列表见 executions.json）。不要求递归上游复验。
- `tests/e2e/{ui501.spec.ts,fixtures/ui501-reference.ts}`、`playwright{,.ui501}.config.ts`：10个 Chromium 成功/拒绝/恢复/基本视觉用例，显式替代 TLS/CORS/合成身份、真实 reference 字节、仅 localhost 出站，合成负面探针独立标注；四组截图/axe。
- `scripts/ui501-review{,.test}.mjs`：冻结输入/二进制/构建/命令/日志/网络/阶段拒绝与下一任务验证；拒绝篡改、跳过、重试、伪造生产或正式通过。
- `docs/operations/ui501-portfolio-risk.md`、前端执行计划：功能边界、恢复规程、状态同步和 P08 交接；`docs/audit/evidence/ui501-local-20261023/`：原始失败与最终完整证据；`.gitattributes`：仅具体原始失败证据空白豁免。

## 测试与验收结果

执行 `node scripts/ui501-review.mjs --run docs/audit/evidence/ui501-local-20261023/attempt-03`，13组命令按预期退出。Vitest111、Rust C06 20项/C16 20项、Gate 5项、Chromium 10项均通过；typecheck/ESLint/静态构建/client-secrets/计划检查通过。四组 axe 0违规、2组非文本导航图标 incomplete（20nodes）；原始报告保留。`--verify` 对最终源码、原始输入、全部日志与产物哈希复核通过。详细命令、结果、失败修复及阶段限制见 README/receipt/executions。

有界工程 Gate：`PASS_UI501_REFERENCE_FUNCTION`。正式功能联调/发布 Gate 未提升：INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。INTEGRATION 执行入口预期拒绝；UI-P08 DEVELOPMENT 执行入口允许。

## 未决风险

- 证据为本机合成参考身份/数据，不证明真实目标 IdP、cookie/CORS、数据库/RLS/事务、真实持久风控/组合源、生产与长期 SSE。参考服务以有限 journal 轮询；目标长期订阅需另行验收。
- C01 不提供角色，界面不猜测 Owner/Operator，风险写逐次由服务端授权；C06 无 If-Match，未伪造 CAS。聚合 GlobalKill 可在账户解除后继续生效。
- 估值、逐仓 P&L、敞口币种/单位与规则明细未由当前契约提供。C16 告警为刷新快照，最多首100条，有下一页显式提示，不作为写授权。
- 未知操作引用只驻内存；离线/撤权/导航关闭会清除。离开前提示未知操作，重新进入须查询当前状态/审计，不自动重放。真实持久恢复未验收。
- Firefox/WebKit、跨OS、人工读屏、原生200%、远程同SHA CI、性能/容量/长稳、完整I4/RELEASE 均 NOT_RUN。

下一可执行任务：**FE:UI-P08：Portfolio and Risk 高保真页面**。本任务未代替该任务或 UI-502 Proposal 风险评估。
