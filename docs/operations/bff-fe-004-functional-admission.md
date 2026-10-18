# BFF-FE-004 / A4 当前功能门禁

仅 C05 Strategy、Backtest、Release 十二项 API 及实际变更影响。前置为 BFF-FE-003/006/007、S01/S02/S03、X3-SERVICE、SERVICE:S04、PROVIDER:A3；九项原始 manifest 作原范围参考，不授予新候选依赖 READY。A3/FE006 用户原确认分别校验原稿、原源码和原回执；FE004 完整稿由用户后续确认。

本机宿主调用真实 StrategyService/DraftService 和 S02/S03，可信目录/源码/时钟由宿主注入。文件和参数编辑只保存新版本；静态检查仅允许匹配可信 Artifact 的已支持策略规则，任意代码/未来引用不执行。CAS 冲突返回 currentVersion/conflictDiff；consumer 保留本地编辑，显式解决冲突后保存。Backtest 使用固定快照、不可变版本和 Artifact 绑定；reportArtifactId 可由 A3 查询（live也仅从同一可信租约按工作区/能力解析，读取审计进入F05；宿主缺失或隔离不回退），stream 为有限资源 journal，续传/去重/缺口拒绝。202 只是受理。Release immutable，allowedTargets 固定 paper/shadow；审批用公共 C08、独立角色/有效 MFA/单次 proof，不能签发 TradeCommand。rollback 只记录受理，不执行部署或 venue submit。

默认 live 没有宿主时503。显式注入的策略宿主为进程内租约：审计持久事务失败后隔离租约；不得把内存恢复当作跨实例/重启恢复。真实 Supabase/Auth/RLS/Storage、目标持久事务/崩溃恢复、实际来源许可和撤权、全页面 P06/P07/G3 与 A4 完整业务联调、部署/性能/容量/长稳及同 SHA hosted CI 分属 INTEGRATION/RELEASE，当前 NOT_RUN。继承核心回测 f64 指标边界，输出字符串不提升计算精度。

`scripts/record-bff-fe-004-functional.mjs` 在冻结源码核对输入后记录十七组当前命令、实际 HTTP/consumer coverage；所有失败/中断保留，必须新 attempt 重试。源码按16MiB批次核验所有 Git blob，原确认也分批，不能跳过大文件。当前输入、规范需求、命令/日志 hash、真实测试断言、API成功/401/403/schema、1000幂等HTTP、基本Chromium、consumer行覆盖>=80%及关键分支100%、人工确认PENDING和runtime DENIED均独立校验。发布 manifest/计划采用回滚保护，并实际运行 development/CI/FE006原确认/直接前置metadata/计划五个入口。

`pnpm check:bff-fe-004` 为严格当前功能门禁；`pnpm check:bff-fe-004:ci` 检查阶段处置且 READY 时执行同一 verifier。组件 CI 不递归重跑前置。新共享代码变更后 FE006 独立当前 READY 撤回为 NOT_ASSESSED，原证据/原确认不改字节、不改绑。无生产凭据、目标连接、外部 push/publish。
