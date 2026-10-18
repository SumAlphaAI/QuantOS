# BFF-FE-001 当前功能准入

依据最新 AGENTS.md，A2_IDENTITY_LOCAL 仅复核 FE:BFF-FE-001 的 C01/C17（20 operations）。当前 API 1.7.0 / 70 published / 62 schemas 的 A1 契约生成输入直接检查，CORE:F06 仅验证身份投影、cookie/origin/CSRF、recent-auth/MFA/过期与权限拒绝边界。直接前置按 reference-only 记录；不递归运行 A1/F06/P0，不拼接历史 READY。

执行顺序：先核验并保存 A1 当前回执，再提交功能源码；在冻结源码上运行 `node scripts/record-bff-fe-001-functional.mjs docs/audit/evidence/bff-fe-001-local-20261018/function-attempt-NN`（NN 必须为新目录），最后保存本轮证据与计划状态。`pnpm check:bff-fe-001:development` 自动识别当前限定回执；`node scripts/bff-fe-001-functional-gate.mjs --ready` 和 CI 使用相同内容验证器。门禁验证真实 Git blobs、规范计划输入、精确执行命令/日志及产物哈希；激活后公共 CLI/CI/计划检查失败会回滚 manifest 与计划。

14 组影响范围验证：A2 契约+三组语义、契约/旧严格门禁负向、生成一致性、F06 身份库、session、CORS、20 operation 实际 HTTP、当前消费者/共用 client/schema/SSE、9 类真实源码变异、TypeScript、lint、新限定门禁负向、计划/CI策略负向及双计划一致性。Rust 单 job、offline；仅从公开 local-mock 模板和环境白名单取输入，禁用目标数据库用例。HTTP/consumer 只启动本机 reference BFF，无数据库或真实 IdP。

修复范围：reference SSE 每次发送（含积压重放）先复核会话有效性；401/403 关闭传入 reducer 并取消响应体，使后续复用同一 reducer 不再重连。验证并发同键只生效一次、不同键同版本只有一个成功，以及版本冲突/changed-intent 无副作用。

功能实现 PASS 可授予本任务 DEVELOPMENT READY，仅用于继续 FE:BFF-FE-007 功能开发。完整页面/API联调、实际 Supabase/Auth/MFA/RLS/持久事务、三浏览器、部署/性能/长稳/同 SHA hosted CI 均 NOT_RUN。数据库与SQL未改，不以静态/本机 reference 验证替代目标验收。PROVIDER:A2、G1、FEP-1、RELEASE、runtime admission 均不由此放行。

项目用户确认稿：确认本轮 FE:BFF-FE-001 的上述本机功能范围、修复及证据，认可继续 FE:BFF-FE-007；未执行联调/目标/发布义务按原阶段保留。本稿状态 PENDING；未获得原始用户答复，formalAccepted=false。遵循 [用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)，不借用旧签署。
