# BFF-FE-005 当前功能准入

依据 AGENTS.md 与分阶段规程，BFF005_SCOPE_LOCAL 仅授予 C12 七项当前本机功能。五项直接依赖保持原 ID，以当前边界检查及 A2 原回执、BFF003 原确认核对；不运行旧40节点闭包，不拼接历史 READY，不重授上游独立 Gate。共享输入变更撤回 BFF003 独立 READY，原确认及所有历史证据保持原字节。

`scripts/bff-fe-005-functional-scope.mjs` 明列18组当前功能/直接影响检查及原因：七API契约/生成、门禁负向、market provider与live纯权限、R01时钟/盘口、R02来源及snapshot拒绝、共享审计/会话A2两provider、实际Rust loopback HTTP及Chromium基本维度切换、实际生成consumer丢响应/并发幂等/版本/审计链/流重复续传和维度隔离、types/lint/clippy、原确认与计划CI。未执行Research Engine、R03 worker或无关全仓/闭包测试。

修复目标：trade接收时间/身份/零价格及空白授权拒绝，跨JS不安全sequence拒绝；watchlist返回auditRef与C10单次审计事实原子关联；consumer在修改缓存/游标前核对instrumentId和provenance维度/授权非空。reference使用合成获准fixture，live保留冷R02来源审批、租户lineage及F05事务bridge；实际目标NOT_RUN，不能据此声称真实许可获批。

先冻结代码，使用 `make bff005-assess-local ATTEMPT=docs/audit/evidence/bff-fe-005-local-20261018/function-attempt-NN`。新attempt按顺序记录实际命令、时间、退出、timeout、源码/输入/日志与产物hash；全部必要结果通过后原子发布manifest和计划，执行development/CI/A2确认/BFF003确认/plans五入口，失败恢复原文件。重复或失败不覆盖历史。当前严格入口为 `pnpm check:bff-fe-005:development` / `make bff005-local-check`，mandatory CI执行`pnpm check:bff-fe-005:ci && pnpm test:bff-fe-005`；旧research-local入口仅历史用途。

DEVELOPMENT功能与完整INTEGRATION/RELEASE分开。R01 B01/FA-H01 source-age、自然告警与实时健康仍有原风险；陈旧行情明确degraded且所有报价executable=false。本机合成与基本Chromium不代表真实市场、完整UI链或发布验收。真实Supabase/Auth/RLS/持久幂等及跨实例恢复、真实来源批准/撤权/身份、完整UI/API联调、部署/安全/性能/长稳/同SHA hosted CI均NOT_RUN；formalAccepted=false、runtimeAdmission=DENIED。完整稿由项目用户确认，Codex不得自行批准；不使用生产凭据、不连接目标库、不启动本地DB、不推送或外部发布。
