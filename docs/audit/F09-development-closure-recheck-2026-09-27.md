# F09 开发阶段剩余问题与关闭复核（2026-09-27）

## 复核结论

依据 [F09 阶段 Gate 边界](F09-stage-gate-review-2026-09-27.md)，当前**尚不能关闭 F09 开发验收**。已部署业务来源、持续告警和同链运行期演练属于 L04；开发期仍须完成写入口 trace 的可核对证据，以及同一完整 SHA 的 CI、Nightly 和测试 Supabase 组件回执。`development_status=COMPLETED` 只表示已有实现，不等于 `review_status=ACCEPTED`。

## 开发期检查明细

| 检查 | 本轮证据 | 状态与边界 |
| --- | --- | --- |
| trace 基础、结构化错误、健康/就绪、告警规则及 ADR 模板 | `make observability-check`：Rust 14 项、Python 9 项、ADR 与规则配置通过；BFF/Runtime 写请求 trace 各 1 项通过 | 组件通过；真实业务路由与持久业务事实仍需逐入口双向核对。 |
| 市场与组合批处理写入口 | 正向命令输出 correlation ID，可从持久 JSONL 找到相同 ID 的 `started`、`succeeded`；缺 trace 路径时拒绝写文件 | 开发期本地路径通过；组合数据库持久化仍缺业务事实与 trace 的目标双向回执。 |
| 阈值、断采、调度与数据库/消费者/Engine 组件故障 | `ca8a6798b05e9fc3b325188ecd2716df65ca1016` 测试 Supabase `quantos-f09-target-gate/v2` 组件 PASS：migration ledger、两次实际分钟调度、三项数据库用例、查询采样、本地 Engine 三次崩溃 | 仅该完整 SHA 的组件回执；后续源码提交须重新绑定，不能沿用旧回执。 |
| 远程 F09 开发工作流 | 同 SHA push run `36320189745` 的 `local-observability` 成功，目标配置预检失败；`d1e6eab6eb9f10934a1dbcc6ed14b4ef8ca37d54` 的 push run `36321340956` 到达测试 Supabase，migration 校验成功，但调度进程因 Rust 连接器不能解析 `sslmode=verify-full` 而失败 | 已修复连接解析，继续严格校验证书和主机名，并拒绝远端禁用 TLS；最终 SHA 的远程目标回执待复跑。 |
| 同 SHA CI 与 Nightly | 草稿 PR #6 已触发 `d1e6eab6eb9f10934a1dbcc6ed14b4ef8ca37d54` 的 CI；run `36321370397` 因 Secret scan 将工作流的 Secret 名称回退表达式误判为 `generic-api-key` 而失败，后续 F02 证据及验签随之缺失 | 工作流已改为直接使用现有 F07 测试环境 Secret；`.gitleaksignore` 仅忽略历史提交这一条精确指纹，本地全 Git 历史扫描通过。最终 SHA 的 CI 和定时 Nightly 回执仍缺。 |

真实 Runtime 目标测试在调度响应中新增“HTTP trace ID 等于已持久化的 `workflow_runs.correlation_id`”断言。首次运行在后段新 TLS 握手被目标关闭；单次有限复测 1/1 通过，含调度、取消、恢复和权限负例。此结果证明本机到测试 Supabase 的业务路径，不替代新提交的同 SHA 目标 Gate。

## 剩余关闭条件

1. 在当前提交之外的任何源码修订完成后，以最终完整 SHA 重新运行开发期快检和测试 Supabase 组件 Gate，保存回执及迁移、故障、trace 证据。
2. 在同一完整 SHA 取得 `QuantOS CI`、F09 Nightly/定时目标及测试 Supabase 组件 PASS；核对工作流元数据和回执内部的 `sourceCommit`，不能只看作业名称或绿色状态。
3. 对真实 BFF 会话与 Runtime 写路由、组合 PostgreSQL 持久化各做业务事实 → correlation ID → 持久 trace 的双向负向/正向核对；未来 X03 正式 Execution 写入口交付时再纳入其业务 Gate。
4. 上述开发证据全部通过后，才将 F09 `review_status` 更新为 `ACCEPTED` 并重新评估 F0 总 Gate；L04 运行期移交仍保持 `NOT RUN / NO RECEIPT`。
