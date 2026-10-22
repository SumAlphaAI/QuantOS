# I2 UI-P12 当前高保真页面复核

当前页面工程 `PASS_UI_P12_CURRENT_PAGE`，工程SHA `8f1f376372a2b5b12a5e2477b746f5940e78a06d`，540项输入、52份候选产物、10项原执行；门禁工具修复 `6bb2d19a924692f0a48c39e3c903a59b6596c452` 单独记账。计划 `IMPLEMENTED_PENDING_ACCEPTANCE`；159个原阶段Gate保持NOT_ASSESSED，人工确认PENDING，formalAccepted=false、runtimeAdmission=DENIED。下一原任务UI-204可继续开发。

任务跨2026-10-22/23（Asia/Shanghai）连续执行，目录保留起始日；原始记录使用实际UTC时间。仅修改QuantOS，在main生成本地提交，未使用生产凭据、推送、部署或全链复验。G1辅助项没有作为开发前置。

[技术回执](./evidence/ui-p12-local-20261022/receipt.json) · [实际命令/日志](./evidence/ui-p12-local-20261022/attempt-01/executions.json) · [完整确认稿](./evidence/ui-p12-local-20261022/confirmation-draft.md) · [范围摘要](./evidence/ui-p12-local-20261022/scope.json) · [功能规程](../operations/ui-p12-audit-workbench.md)。

## 变更文件

| 文件 | 交付 |
|---|---|
| `apps/terminal/app/audit/workspace.tsx`、`workspace.css`、`workspace.stories.tsx` | P12四栏/抽屉、主搜索、服务端排序、主题/响应式、键盘详情、焦点与复制回退、7态呈现 |
| `apps/terminal/src/audit/presentation.ts`、`runtime.ts` | 规范及兼容资源引用、严格冲突拒绝、UTC/范围/状态投影；只增加复用guard的显式检查入口 |
| `apps/terminal/public/terminal-route-map.json`、`_redirects` | 静态资源路由表与托管示例 |
| `scripts/serve-static.mjs`、`terminal-static-routes.mjs`、对应测试 | 实际Terminal UUID资源路径映射，非通用SPA回退；无路由表的website不受影响 |
| `apps/terminal/tests/ui-p12-presentation.test.ts` | 20项引用/投影/状态边界测试 |
| `tests/e2e/ui-p12.spec.ts`、`fixtures/ui-p12-reference.ts`、六张快照、`playwright.ui-p12.config.ts`、`playwright.config.ts` | 8项P12 + 6项直接受影响UI-507页面回归，14项有界Chromium；6图比较/6次axe |
| `scripts/ui-p12-review.mjs`、对应测试、`package.json` | 有界门禁、历史原SHA复用、当前候选校验、工具单独修正续核入口 |
| 执行计划、本报告、功能规程与本轮证据目录、`.gitattributes` | 同步原任务、原始失败/截图/输入与确认稿；仅一个失败上下文精确空白例外 |

完整清单见[changed-files.txt](./evidence/ui-p12-local-20261022/changed-files.txt)。没有修改C10/OpenAPI/Rust供应方或UI-507原确认/回执。原UI-507确认与G1历史仍按其工程SHA引用，不改绑当前页。

## 测试命令与结果

工程入口 `node scripts/ui-p12-review.mjs --run docs/audit/evidence/ui-p12-local-20261022/attempt-01`。白名单公开模板环境，无私有dotenv/目标配置；10项原命令与时间/退出码见执行记录。

| 命令 | 结果 |
|---|---|
| `node scripts/development-execution.mjs --development FE:UI-P12` | exit0，原功能开发允许 |
| `pnpm exec vitest run apps/terminal/tests/ui-p12-presentation.test.ts apps/terminal/tests/audit-runtime.test.ts apps/terminal/tests/audit-gateway.test.ts`（JSON报告参数见记录） | 46/46：20新投影、18既有runtime、8既有C10 |
| `pnpm --filter @sumalpha/terminal typecheck` | exit0 |
| `pnpm exec eslint`（本轮页面/runtime/直接测试/静态服务和门禁） | exit0，完整路径见执行记录 |
| `pnpm --filter @sumalpha/terminal build` | exit0；`terminal-8f1f376372a2b5b12a5e2477b746f5940e78a06d`，75文件客户端秘密扫描PASS |
| `pnpm exec playwright test --config=playwright.ui-p12.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui-p12-local-20261022/attempt-01/browser` | 14/14，retry/skip/flaky=0；不带update-snapshots |
| `node --test scripts/ui-p12-review.test.mjs scripts/terminal-static-routes.test.mjs` | 49/49（40门禁、9路由） |
| `node scripts/check-development-plans.mjs` | exit0，159阶段Gate均NOT_ASSESSED |
| `node scripts/development-execution.mjs --integration FE:UI-P12` | **预期exit1**，STAGE_NOT_READY |
| `node scripts/development-execution.mjs --development FE:UI-204` | exit0，下一原任务开发允许 |

实际路由验证：规范/audit/:correlationId、/exports/:exportId直达/重载，query兼容、非法/冲突引用无资源请求、服务端排序/分页、详情tab键盘、引用复制拒绝、固定/清除筛选、服务错误显式恢复、抽屉关闭/恢复焦点、只读UI收窄、延迟授权无私有数据。UI-507受影响实际路由验证MFA/reauth创建、queued→ready/真实附件、取消、丢失响应同键恢复、断流/离线/401/403/404/过期/移动查询。真实附件4743字节，SHA-256 `769519df2a4f797911c1ea7b51bd8d1b36f47c3598ef81c719174e3f49455c7f`，与本轮租约及内容响应一致，不将导航200当接收通过。

1672/1024/390 × dark/light六张Chromium/Darwin冻结图比较通过；6次axe均0违规，各有1项incomplete（共6项）保留原JSON，不记作人工可访问性通过。设计图hash `sha256:e1572f14d7c2abe6fb59733a3d06d499143ed7f0aa5d14889c3e368701798ac0`；使用既有冻结tokens，P12页内紧凑布局适配。数据为实际reference授权事实，缺少的百分比/签名验签/根哈希不按PNG虚构。设计中的10分钟下载文案服从既有C10最长300秒上限。

## 封装修正与原证据复用

原10项检查全部达预期后，首次回执封装读取设计PNG的Git子进程超出默认buffer，报ENOBUFS；原始工具输出摘要见[记录](./evidence/ui-p12-local-20261022/verification-fix-01/recording-note.md)。未覆盖attempt-01任何原输入/日志/产物；修复提交只改门禁一个文件，增加显式大buffer及同SHA续核。工具修复后仅执行49项工具/路由测试和该门禁lint，不复跑功能、构建、浏览器或依赖链。

续核命令：`node scripts/ui-p12-review.mjs --resume-verification docs/audit/evidence/ui-p12-local-20261022/attempt-01 docs/audit/evidence/ui-p12-local-20261022/verification-fix-01/correction.json`，exit0。当前 `node scripts/ui-p12-review.mjs --verify`通过，输出保留工程8f1f3763、独立校验工具6bb2d19a；检查两提交只差门禁文件，其余539项原输入不变，540项原输入仍绑定原Git。没有把新工具或证据提交当作新产品测试通过。

UI-507原520输入只按原9f7552a8 Git验证，32产物/确认摘要原字节保留；其原55/39结果不复跑、不改绑。245个Rust源输入未变，精确复用原reference二进制 `sha256:a901fa03b4300b174e8addae522fed29a4e85f6ff18b579f495234d277ece6d7`，不重建Rust。原NOT_RUN账本整体保留。预检首次lint、合成只读代理Content-Length失败、视觉修订与首次封装失败分别留存，[预检说明](./evidence/ui-p12-local-20261022/preflight-notes.json)不替代候选结果。

## 风险与Gate

- reference身份cookie/CORS明确由loopback测试代理替代；真实IdP/MFA、cookie/CORS、目标DB/storage、跨进程撤权和持久恢复仍NOT_RUN。只读能力收窄、503和800ms延迟是明示合成边界，不证明目标RBAC或性能。
- Firefox既有环境阻塞、WebKit拦截附件接收阻塞及原账本全部NOT_RUN原字节保留；未复试或提升。人工读屏/原生200%、跨OS/设备、远程同SHA CI、容量/性能/长稳、生产TLS与发布NOT_RUN。
- localhost静态服务已验证规范路由；裸Next dev使用/audit、/exports/query。资源别名依赖静态服务/托管重写，目标CDN/托管配置和发布未执行，NOT_RUN。
- 只声明当前授权范围完整与服务端脱敏/哈希字段；C10缺少的全局统计、百分比和独立签名验证不伪造。未知意图仍仅当前页内存恢复，离开后先查审计再创建。
- 工程 `PASS_UI_P12_CURRENT_PAGE`；人工确认PENDING；原INTEGRATION NOT_ASSESSED、G1/FEP-1 NOT_READY_GAPS_OPEN；formalAccepted=false、runtimeAdmission=DENIED。未把辅助项变成开发前置，没有上游运行、当前HEAD或发布准入。

下一可执行原任务：**I2 UI-204：DataSnapshot 目录/详情、质量/许可/时效**，按其实际变更执行直接验证，无需等待本稿确认或关闭G1辅助项。
