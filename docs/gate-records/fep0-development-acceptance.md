# F0 / FEP-0 DEVELOPMENT 功能验收

FEP-0 依赖 CORE-GATE:F0、PRE-01～06、FRONTEND-GATE:G0。阶段准入消费当前内容绑定回执，不复制历史正式 ACCEPTED 或任意审计 Markdown。

1. 提交功能源码，保持干净工作区，使用 Node 24.12.0 / pnpm 10.20.0。
2. `pnpm assess:f0-development docs/audit/evidence/provider-a1-remediation-20261004/fep0-20261005`：执行 F0 与 A1 闭包。三轮构建、F06 和 F09 的干净源码检查先执行，在外部/忽略目录收集输出，最后保存不可变日志；每次复评使用新的子目录。
3. `node scripts/g0-development.mjs --assess`：复评 G0 工程。当前范围变化时由 Codex 拟稿、项目用户一人确认；缺确认保持 BLOCKED，不自行批准。确认后 `node scripts/g0-development.mjs --finalize` 先核验原工程输入、日志/依赖和原 PENDING snapshot，再消费真实用户答复；保留原 pending manifest，复用未变化的实际执行。
4. `pnpm assess:fep0` 生成里程碑清单；后续评估传入新的子目录，如 `pnpm assess:fep0 docs/audit/evidence/fep0-remediation-20261005/user-confirmed`，不覆盖原执行。`pnpm check:fep0:engineering` 验证完整工程链；`pnpm check:fep0` 必须八项 READY。CI 校验完整工程链及拒绝探针，绿色工程 CI 不代表用户确认完成。

F02 真实 schema/RLS 负向使用已有 Supabase 的事务内 DDL，每次 rollback 后核对 catalog 不变；不创建本机或临时参考数据库、不 reset。它证明当前检查机制，完整重建的发布回执保持独立。所有数据库实际执行与无库静态执行分别标记。

F07 使用现有配置的 BFF/Runtime 独立数据库角色、验证 TLS 和专属测试身份；Storage 使用现有管理员 key 的工程诊断明确记账，服务回执仍为 DIAGNOSTIC_ONLY。100 checkpoint 恢复/唯一 Artifact 与 cancel/timeout 审计是功能门槛；调度 P95、部署 HTTPS、受限 Runtime Storage 身份由 L04/RELEASE 收口。

F08 使用实际 wheel、受控 UDS 子进程和九个 release 编译功能场景；local process 结果不等于 hosted target。F09 检查三类持久写 trace、真实数据库/消费者恢复、查询采样、Engine 崩溃与确定性告警；实际部署生产者、通知、持续监控及 hosted CI/Nightly 留在 RELEASE。

manifest 绑定规范任务输入、源码/契约/配置/测试、实际命令/执行时间/退出码、日志/产物摘要、目标环境与依赖摘要。缺 F0、假摘要、历史文档、日志替换、少跑必要检查、输入漂移、未 READY 前置均拒绝。聚合本身没有重新连接数据库，数据库事实来自经过核验的子回执。
