# F06/F07 Auth 500 与 F09 调度超时整改复评

本轮定位并修复开发目标检查的错误诊断和 F09 收尾缺陷；Supabase 平台只读限制尚未恢复。保持“不升级订阅、不使用生产凭据、不执行外部发布”，不运行本地 PostgreSQL/Supabase，不绕过服务端只读限制，不扩大 R03_LOCAL 范围。

北京时间 2026-10-12 08:46:04 的[实测诊断](./evidence/f0-target-diagnostics-20261012/diagnosis/live.json)在同一开发项目观察到事务和默认事务 `read_only=on`、`in_recovery=false`；现有测试用户登录返回 HTTP 500、unexpected_failure、Database error granting user。F06 500 来自远程 Auth，发生在本地 BFF 启动前；F07 上轮 500 来自远程 Auth 创建测试身份，同样发生在 BFF/Runtime 启动前。结合目标只读，对写入相关 Auth 失败的归因得到支持；未取得平台内部 Auth 日志，不能宣称服务端容量限制已解除。

原 F09 调度检查在只读目标无法生成 tick，后续 DELETE 再次触发 25006；清理失败跳过 `client.end()`，覆盖主错误并留下可能过早写出的 PASS。外层最终以 300 秒超时终止。[原源码与 VM 红测](./evidence/f0-target-diagnostics-20261012/diagnosis/f09-red-result.json)复现连接未关闭和 PASS 保留；这是假对象的生命周期回归，不能作为数据库验收。原 56 组失败索引、三份失败 Gate 及本轮覆盖前的 TP03/TP04 完整组件字节均绑定在[历史清单](./evidence/f0-target-diagnostics-20261012/history.json)。红测 VM 首次缺少 URL 全局的辅助脚本失败也保留。

代码调整：

- 共享只读状态观察用于 F06 preflight、F07 实际服务检查、F09 目标 Gate 和独立 scheduler；只读或恢复中明确 `TARGET_DATABASE_READ_ONLY`，在 Auth 写入/monitor 启动前拒绝，不作为 PASS。
- Auth 非成功响应只保存白名单状态/错误码/数据库错误类别，不保存任意响应、身份或 token，不重试 HTTP 500。
- F09 记录主错误及独立清理错误；先停止所属进程，再清理所属 scope、始终关闭连接，最后才能写 PASS。已信号退出的进程不等待已发生的 exit；忽略 SIGTERM 时有界 SIGKILL；无 owned rows 不执行 DELETE。
- 新生命周期及只读/错误分类回归接入原 F06/F09 必要负向命令，不修改严格 Gate 范围。

冻结前纯 JS/所属进程回归 43/43 PASS（含原 F07 17 项）；F06 必要负向 55 项 PASS。修复后定向实测三个检查均在约 2 秒以只读原因失败，F07 未启动服务/未发送 Auth 登录，F09 未启动 monitor、无 cleanup 写入、连接关闭；见[定向结果](./evidence/f0-target-diagnostics-20261012/diagnosis/prefreeze-target-checks.json)。此轮有源码变更，定向结果仅诊断，不作为准入。

待从新干净冻结提交执行 TP03、TP04、F0 必要闭包完整复验；工程、数据库、hosted CI、用户正式确认与发布验收分别记录。当前旧 Gate 撤为 NOT_ASSESSED，原失败回执保持不可覆盖。
