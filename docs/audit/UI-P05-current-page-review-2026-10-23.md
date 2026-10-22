# UI-P05 当前页面报告（2026-10-23）

当前页面门禁 **PASS_UI_P05_CURRENT_PAGE**，工程 `a76cca2194fa341bba3fb2e0883e8b137cb94bbd`；539输入、56产物、10条当前命令。计划为IMPLEMENTED_PENDING_ACCEPTANCE，完整确认稿待项目用户。159阶段Gate保持NOT_ASSESSED，G1/FEP-1缺口保持，未提升正式/运行/联调/发布验收。

## 变更文件与交付

- `apps/terminal/app/data-snapshots/workspace.tsx` / `workspace.css`：P05目录/详情双栏、TerminalFrame与实际权限导航、双主题、桌面/1024/390响应式、质量/时效阻断、服务端过滤分页、本页计数、来源与许可面板。
- `apps/terminal/src/data-snapshots/presentation.ts`：UTC/短引用、本页政策计数、两项对比选择、白名单C04元数据投影；保留原runtime/policy/gateway及245项Rust输入原字节。
- `apps/terminal/tests/ui-p05-presentation.test.ts`、`tests/e2e/ui-p05.spec.ts` / `fixtures/ui-p05-reference.ts`、`playwright.ui-p05.config.ts`：19项新展示/边界测试及7项P05浏览器，直接回归原55项policy/runtime和6项UI-204浏览器。P05独立hooks夹具沿用原fixture实现模式，原UI-204 spec/fixture不变。
- `tests/e2e/ui-p05.spec.ts-snapshots/`：两主题×三宽度6张PNG。`playwright.config.ts`隔离需reference的测试入口，常规CI不隐式启动本轮本机fixture。
- `scripts/ui-p05-review.*`、[规程](../operations/ui-p05-data-snapshot-workbench.md)、[计划](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-ui-p05)、本轮报告、[原始证据](./evidence/ui-p05-local-20261023/README.md)及[完整确认稿](./evidence/ui-p05-local-20261023/confirmation-draft.md)。完整变更清单随证据封存。

设计依据为仓库P05原图，结构按目录/详情与质量卡、时间窗、Schema/血缘/许可、底部操作区落实，颜色继承冻结PRE02语义token。上下文展示真实C01 ID/模式，仅显示获授权导航。C04未返回质量分数、覆盖率、全局总量/工作流数、dataset字段定义、symbol/provider细节或中间血缘/许可批准范围，页面明确缺失，不填图中示例事实。来源图只表达接口sources→当前DataSnapshot。

对比最多两份内存引用，显式重读两者，换查询或失效清除。标签支持方向键/Home/End，关闭详情恢复原行焦点；复制失败给手动选取引用。下载重新读取并复核C01/route-access，仅导出文档化C04白名单JSON，不包含数据集、passthrough字段、签名外链或业务执行许可。所有策略/交易用途阻断沿用UI-204。

## 命令与结果

74项单测（19新展示/投影+55原policy/runtime）、13个Chromium（7新P05+6受影响UI-204）、50项门禁/路由通过。类型、lint、终端构建和79文件客户端扫描通过。6张冻结PNG比对、六次axe零violations；每次保留1条color-contrast incomplete（图标非文本字符，6条合计），不声称完整无障碍通过。

| 命令 | 退出码与结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-P05` | 0，通过 |
| `pnpm exec vitest run apps/terminal/tests/ui-p05-presentation.test.ts apps/terminal/tests/data-snapshot.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/ui-p05-local-20261023/attempt-01/unit.json` | 0，通过 |
| `pnpm --filter @sumalpha/terminal typecheck` | 0，通过 |
| `pnpm exec eslint apps/terminal/app/data-snapshots apps/terminal/src/data-snapshots/presentation.ts apps/terminal/tests/ui-p05-presentation.test.ts scripts/ui-p05-review.mjs scripts/ui-p05-review.test.mjs playwright.ui-p05.config.ts playwright.config.ts tests/e2e/ui-p05.spec.ts tests/e2e/fixtures/ui-p05-reference.ts` | 0，通过 |
| `pnpm --filter @sumalpha/terminal build` | 0，通过 |
| `pnpm exec playwright test --config=playwright.ui-p05.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui-p05-local-20261023/attempt-01/browser` | 0，通过 |
| `node --test scripts/ui-p05-review.test.mjs scripts/terminal-static-routes.test.mjs` | 0，通过 |
| `node scripts/check-development-plans.mjs` | 0，通过 |
| `node scripts/development-execution.mjs --integration FE:UI-P05` | 1，预期拒绝STAGE_NOT_READY |
| `node scripts/development-execution.mjs --development FE:UI-201` | 0，通过 |

`node scripts/ui-p05-review.mjs --verify` 为只读续核，不重新运行功能链。详见[原命令/时间/摘要](./evidence/ui-p05-local-20261023/attempt-01/executions.json)、[工程回执](./evidence/ui-p05-local-20261023/receipt.json)。

实际浏览器证明规范/兼容详情、服务端查询与分页、failed/license_missing拒绝、合成degraded/expired/503和恢复、离线清除、能力收窄与歧义参数无数据、慢身份无提前事实；新覆盖键盘/焦点、复制fallback、比较重读/清除、白名单元数据实际接收及读取后发布前撤权不交付、恢复不重放。全部业务请求GET；元数据482字节，SHA-256 `2c8cc335298470dbab6f5916e20f471a7799ff0823ad3b1596eaa0a3536ae9b4`，见metadata.json与metadata-receipt.json原文件。只证明当前授权元数据JSON，未提升数据集/生产导出验收。

六张视觉基线仅遮罩真实变化的时间文本与最近读取时间，不改reference响应；以固定snapshotId服务端过滤，未假设随机附加快照的排序。桌面深浅和小屏详情未遮罩截图已查看；catalog列表可在自身滚动区横向滚动，整页三宽度均无水平溢出。没有全量数据、完整字段Schema或许可批准可视化的虚构补齐。

## 复用、失败与边界

复用UI-204工程54ab042b、证据f7ebc51f、确认a4dc02c2与历史ledger；524原输入在其原Git验证、33原产物保持，原Rust23/前端110/浏览器6/门禁50不改绑为本候选。245项Rust输入与二进制摘要不变，原binary来源仍54ab042b，不重建、不重跑Rust或G1依赖闭包。当前构建与13个浏览器记录独立绑定a76cca21。

[预检查说明](./evidence/ui-p05-local-20261023/preflight-notes.md)保存首次lint/build失败、共享hooks首例失败（11/12）、原卡片挤压截图和旧aria incomplete。修正后预检查13/13，再冻结工程，用已提交PNG执行本轮独立比对；最终没有--update-snapshots，也不拼接预检查通过为当前通过。

reference身份为EXPLICIT_REFERENCE_COOKIE_BRIDGE，CORS为LOOPBACK_PROXY_SUBSTITUTION；Firefox为BLOCKED_ENVIRONMENT，WebKit附件接收为BLOCKED_ENVIRONMENT_TEST_INTERCEPTION。合成能力收窄/503/延迟/质量收窄逐条标注。全部历史NOT_RUN保持原值；真实IdP/MFA、Cookie/CORS、目标数据库、生产托管rewrite、目标策略/交易提交、人工读屏/原生200%缩放、跨OS/设备、同SHA远程CI、性能/长稳及发布未验收。图标对比度仍需人工核验。没有使用生产凭据、推送或部署。

完整确认稿PENDING，formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。下一原任务 **I2 UI-201：Research列表、新建与表单校验**，开发入口允许，无G1辅助项前置。
