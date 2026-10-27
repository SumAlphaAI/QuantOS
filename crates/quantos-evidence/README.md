# quantos-evidence

SERVICE:L04 的本地恢复检查与证据模型。当前 `local` 模块通过可信 F05 读取端口重放 X01、校验 X06 安全审计及 X05/F09 报告，并将受限 evidence 以不可覆盖、fsync 的本地文件归档；新 `l04-evidence` 进程仅只读验证。它不恢复跨进程交易状态，不建立数据库连接、不加载凭据或授予执行权限。

v2 旧报告修复空耗时/矛盾计数、未完成样本及重复 drill 的误判。`audit_signature_coverage_pct` 表示调用者提供的签名计数，不再命名为持久化率；四类 drill 必须各一份，checklist 非空且 ID 不重复。`local_checks_passed()` 仅组合旧报告的局部检查结果；`go_no_go_ready()` 始终 false，目标/发布授权必须独立取得。旧字符串扫描和 fixture MFA 不能签署安全或审批验收。

```sh
cargo test --locked --offline -p quantos-evidence --test service_l04 --test service_l04_report
node scripts/service-l04-review.mjs --verify
```

本地归档头摘要须由可信 owner 独立保存；路径/父目录权限与数据库来源完整性由宿主负责。真实 Supabase/RLS/事务、业务审计持久化、跨重启恢复、testnet、部署/通知、负载/安全/持续窗口、CI 和发布均未由本 crate 的本地样本证明。详见[当前规程](../../docs/operations/service-l04-current-assessment.md)。
