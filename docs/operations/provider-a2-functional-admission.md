# PROVIDER:A2 当前功能汇总准入

依据最新 [AGENTS.md](../../AGENTS.md) 和[分阶段测试规程](phased-testing.md)，A2_SCOPE_LOCAL仅验证C01/C17/C10共26项当前API及直接消费边界。原BFF-FE-001与007回执、冻结源码、日志和用户确认逐项核对，但不改绑成当前候选READY；F05/A1仅直接边界。共享门禁/输入变化撤回BFF-FE-007独立READY，历史确认及回执保留原范围。

`scripts/provider-a2-functional-scope.mjs`明列16组命令和原因：当前契约/负向、生成输出、F05静态与tenant/checkpoint两项纯函数行为、两组Rust provider、共享audit core、26操作真实loopback HTTP、生成consumer与同会话身份/导出/注销拒绝组合、types/lint、用户确认负向、汇总门禁负向、计划/CI。不执行旧17节点上游闭包、全仓或三轮构建。两子任务变异证据只核对原始hash，不声称当前候选执行变异；本轮未修改Rust运行时，当前provider/consumer/权限与恢复行为重新执行。

使用固定pnpm10.20.0与白名单公开local-mock环境，cargo locked/offline单job。禁止生产凭据、真实数据库、IdP或存储调用，禁止本地数据库与外部发布。HTTP仅127.0.0.1 Rust reference；下载仅验证metadata，不获取reference URL。

先提交冻结功能输入，再执行 `node scripts/record-provider-a2-functional.mjs docs/audit/evidence/provider-a2-local-20261018/function-attempt-NN`。失败/超时/中断保存在新目录，不拼接不同源码结果。16组实际正常退出、Git源码/输入/命令/日志/26项成功与拒绝覆盖验证后，事务发布汇总manifest与checkpoint；development、CI、两原确认及plans共5项真实入口必须通过，否则恢复原manifest及计划。

`pnpm check:provider-a2` 与 `pnpm check:provider-a2:ci`会识别当前scoped manifest并执行严格内容校验；旧target与A2_LOCAL入口保留原用途。单独静态coverage、旧结果或NOT_ASSESSED的CI disposition不能替代当前汇总准入。

functionImplementation=PASS仅限本机当前功能；businessIntegration/releaseAcceptance=NOT_RUN、formalAccepted=false、runtimeAdmission=DENIED。真实Supabase/Auth/RLS/跨租户持久事务、worker lease进程重启、私有对象与一次性票据、完整UI链、部署、性能、长稳和同SHA hosted CI在联调/发布另验。本汇总确认稿须项目用户后续明确确认；两原确认不自动批准汇总。

首次冻结尝试因F001负向单测读取被忽略的旧`artifacts`执行缓存而失败。修复将其明确为源码摘要绑定的synthetic receiver fixture，增加当前structure通过且缺执行证明仍拒绝的用例；CLI与当前汇总对真实执行证明的要求不变。失败日志完整保存，修复后使用新源码/新attempt重跑当前范围。
