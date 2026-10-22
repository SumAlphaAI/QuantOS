# G1-REC-02 同候选本机旅程、审计与恢复验证（2026-10-22）

**PASS_LOCAL_JOURNEY_WITH_EXPLICIT_PORT_SUBSTITUTIONS**；工程 `38569928f3557f80ca8bf3717d1f77882cf1e5ae`、577项冻结输入，9条限定检查全部通过。本轮确认稿PENDING；G1/FEP-1仍NOT_READY_GAPS_OPEN、INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。仅本机端口替代组合，不授全G1、真实环境、I2或RELEASE准入。

依据[前端计划](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)、[原缺口](./FRONTEND-G1-FEP1-local-gap-review-2026-10-22.md)及[REC-01原确认](./evidence/g1-recovery-confirmation-20261022/README.md)。[机器回执](./evidence/g1-journey-local-20261022/receipt.json)、[逐案矩阵](./evidence/g1-journey-local-20261022/journey-matrix.json)、[源码定位](./evidence/g1-journey-local-20261022/source-findings.json)、[范围摘要](./evidence/g1-journey-local-20261022/scope.json)、[完整确认稿](./evidence/g1-journey-local-20261022/confirmation-draft.md)。

## 结果与必要整改

实际浏览器登录页和回调→Command→P15资料保存、通知保存、安全MFA/reauth/撤销202→明确重读移除远端会话→P17历史→用户点击新租约→真实HTTPS附件→C10审计关联在同一前端buildId、同一Rust二进制下通过。每案独立进程，最终10案均无skip/retry/fail。主链实际收到4743字节；文件SHA256与reference签发元数据及原内容传输一致，重复ticket返回410，历史与审计不含短链。资料/通知响应correlation解析唯一事件，安全202 auditRef解析唯一eventId，审计redactedPayload的canonical hash均复核。

核对发现reference profile/notification/security只写旧action/auditRef条目，C10按eventId过滤后不可查；这是当前审计关联缺陷。改为现有结构化审计格式（eventId/kind/correlation/causation/sequence/redactedPayload/payloadHash），保留action别名、内部计数与原幂等执行一次规则。私有资料/MFA/幂等键不写审计；live provider/DB规则未改。新增Rust真实路由回归，原15项身份测试与14项导出审计直接回归一并通过。

恢复矩阵另验证真实CAS409保稿、明确rebase再保存；服务端已提交后截断响应，UI提示结果未知并保持意图，明确重试沿用同一key/body/version且只变更/记审计一次；DELETE未知结果不自动重发，显式重读核对已撤销事实；真实MFA第5次错误429不进入reauth/DELETE；合成2秒429等待后明确再试；reference401要求新登录，reference403清空私有UI；断流/离线后清除草稿并显式新读、跨页面返回Command无写入重放；篡改callback state消费pending后拒绝交换。取消请求不代表回滚。

## 明确替代与未执行边界

reference BFF没有真实OIDC issuer和/v1/auth/session。测试桥4010提供一次性code/S256校验与session建立fixture，再注入reference身份cookie；真实IdP、Cookie/SameSite/CORS和持久会话均NOT_RUN。前端3190、TLS桥4010、Rust随机环回端口，临时证书信任例外只在测试context；外部网络请求被阻止。导出创建未有适用UI，本轮明确以NODE_CONTROL_PORT调用实际MFA/reauth/createExport，之后P17点击与附件为实际浏览器，不改下载URL/签名或provider正常响应字节。桥中429、错误callback和响应截断标注synthetic/故障；401/403与MFA429是实际reference返回，身份切换仍为fixture切换。

这不等于完整无替身G1或目标授权旅程，原fullG1BusinessJourney/fullP17BrowserJourney及所有历史NOT_RUN原字节保留。另补真实MFA60秒冷却到期NOT_RUN，短429不替代它。应用不自动重放不保证浏览器底层网络栈不重试；首次头前断连注入确实触发Chromium透明重试，预检记录保留，服务端幂等拒绝重复效果仍必要。settings重放成功HTTP correlation可能重分配，原业务事实由原意图/原成功事件/版本关联，不虚构第二个业务事件。

Firefox BLOCKED_ENVIRONMENT、WebKit BLOCKED_ENVIRONMENT_TEST_INTERCEPTION及原全部NOT_RUN/incomplete/历史失败保留。真实目标DB/Storage/RLS/IdP/MFA/授权流/领域实时/持久撤销，完整导出创建UI、人工读屏/原生200%、跨OS/设备、远程同SHA CI、性能/长稳/后台调度、可信生产TLS与RELEASE未执行。[嵌套保留账本](./evidence/g1-journey-local-20261022/retained-boundaries.json)。未读取生产凭据、未连接目标服务，无本地PostgreSQL/Supabase、推送或部署。

## 实际命令与原始结果

| 检查 | 命令 | 结果 | 日志 |
|---|---|---|---|
| rust-auth | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider` | exit 0 | [原始日志](./evidence/g1-journey-local-20261022/attempt-01/rust-auth.log) |
| rust-audit | `cargo test --locked --offline -p bff-gateway --test audit_export_provider` | exit 0 | [原始日志](./evidence/g1-journey-local-20261022/attempt-01/rust-audit.log) |
| bff-build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | exit 0 | [原始日志](./evidence/g1-journey-local-20261022/attempt-01/bff-build.log) |
| types | `pnpm --filter @sumalpha/terminal typecheck` | exit 0 | [原始日志](./evidence/g1-journey-local-20261022/attempt-01/types.log) |
| lint | `pnpm exec eslint tests/e2e/g1-journey.spec.ts playwright.g1-journey.config.ts playwright.config.ts scripts/g1-journey-review.mjs scripts/g1-journey-review.test.mjs` | exit 0 | [原始日志](./evidence/g1-journey-local-20261022/attempt-01/lint.log) |
| terminal-build | `pnpm --filter @sumalpha/terminal build` | exit 0 | [原始日志](./evidence/g1-journey-local-20261022/attempt-01/terminal-build.log) |
| browser | `pnpm exec playwright test --config=playwright.g1-journey.config.ts --project=chromium --retries=0 --workers=1 --reporter=list,json --output=docs/audit/evidence/g1-journey-local-20261022/attempt-01/browser` | exit 0 | [原始日志](./evidence/g1-journey-local-20261022/attempt-01/browser.log) |
| gate-negative | `node --test scripts/g1-journey-review.test.mjs` | exit 0 | [原始日志](./evidence/g1-journey-local-20261022/attempt-01/gate-negative.log) |
| plans | `node scripts/check-development-plans.mjs` | exit 0 | [原始日志](./evidence/g1-journey-local-20261022/attempt-01/plans.log) |

Rust身份/设置16，审计/导出14；Chromium10；门禁77；类型、Lint、构建与计划均通过。精确白名单环境与参数见冻结门禁，时间/返回码/日志hash见[executions](./evidence/g1-journey-local-20261022/attempt-01/executions.json)。未触发F05/F07、真实数据库、无关上游全闭包或发布矩阵。

原DL工程354、REC-01工程591输入分别在其原SHA核验；四个旧包共64+18+195+18个hash条目按原证据提交核验，旧确认仍只原稿/SHA。159项计划stage_gate、规范依赖与development状态均不变。当前局部组合不授历史依赖READY。复核 `node scripts/g1-journey-review.mjs --verify`。

## 失败保留与下一任务

预检01 lint两处any，结构化审计后内部旧计数过滤导致10通过6失败；修正窄类型与计数兼容。预检02浏览器因沙箱EPERM未执行，在授权环回环境重新运行。预检03为7通过3失败：头前断连触发透明重试、MFA失败清码需重输；原JSON、上下文和trace均保留。预检04为10通过，仍未冻结且早于最终内容attestation断言；预检05/06为限定门禁/lint/Rust/计划预检。最终attempt-01独立绑定38569928，不拼预检PASS。中间预检未捕获全部源码快照，不声称可独立复现；失败trace仅含公开合成身份/PKCE/测试数据。[完整历史](./evidence/g1-journey-local-20261022/attempt-history.json)。

REC-02 IMPLEMENTED_VERIFIED_LOCAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS，确认PENDING。原8项中4项局部工程已验证，其他4项（DEP-01、P15确认、浏览器环境、目标义务）不变；[最新账本](./evidence/g1-journey-local-20261022/remediation-status.json)。G1 review_status仍CHANGES_REQUESTED，G1/FEP-1 NOT_READY_GAPS_OPEN，INTEGRATION NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。

下一可执行 **G1-DEP-01**：按当前候选对G1的13项、FEP-1的26项直接前提（并集27）登记适用性、原确认及输入差异，按影响补组合，不机械重跑上游；P15仍需独立确认，REC-02本稿需项目用户确认后另记。不得直接解锁I2或发布。

## 变更文件

- `docs/operations/g1-local-journey.md`
- `playwright.config.ts`
- `playwright.g1-journey.config.ts`
- `scripts/g1-journey-review.mjs`
- `scripts/g1-journey-review.test.mjs`
- `services/bff-gateway/src/lib.rs`
- `services/bff-gateway/tests/auth_settings_provider.rs`
- `tests/e2e/g1-journey.spec.ts`

另更新前端执行计划，并新增本报告与 `docs/audit/evidence/g1-journey-local-20261022/` 的回执、范围、矩阵、确认稿、失败记录和封存索引。原报告/确认/工程证据包不修改。
