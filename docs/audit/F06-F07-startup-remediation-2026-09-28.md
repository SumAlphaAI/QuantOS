# F06/F07 目标验收失败定位与修复（2026-09-28）

## 1. 结论与范围

此前通过的 F06/F07 回执仍是其对应源码和环境的有效历史证据。`09c867915065f9e5800f3e8667bb63a2e860a5de` 本轮失败不是权限或业务实现被合并改坏：此前通过至该 main 的相关服务源码没有变化，但测试库被完整重建，且初期多个目标作业同时占用共享连接池。

本次修复测试准备、Runtime 启动和失败回执处理的缺陷，**修复工作树的 F06 Runtime 身份链、F07 完整目标服务链已在实际 Supabase 通过复验**。未修改严格 TLS、角色隔离、启动探测次数、请求超时、调度 P95 或覆盖率门槛；没有把失败重写成成功。

此文及附件记录提交前工作树验证；附件中 `dirty=true` 不改写。提交后再次执行受影响的目标链路，将结果以 Git note `refs/notes/f06-f07-startup-fix` 绑定完整修复 SHA。新 SHA 的远程 CI/Nightly 尚未运行，本文不替代完整 main/F0 总验收。

## 2. 原因、证据与修复

| ID | 原因与具体表现 | 修复 | 边界 |
| --- | --- | --- | --- |
| FIX-01 | 授权重建 `quantos` 后，Auth 用户仍存在，原测试租户、账户和成员映射已不存在。前轮准备阶段遗漏恢复，BFF 因无身份映射正确返回 401。 | 新增 `f06-test-identity-check` 与显式 `f06-test-identity-restore`。校验既有 Auth ID/email，仅在业务上下文完全缺失时用事务恢复最小 paper/operator fixture；已有但残缺或冲突的映射拒绝覆盖。 | 不新建 Auth 用户，不改密码和本地凭据，不扩张既有权限。此项是验收准备问题，不能通过降低身份校验解决。 |
| FIX-02 | Runtime 依次建立 BFF Auth、Runtime、worker 三条独立连接。分段实测 6282/4461/3673ms，串行连接累计约 14.42s，加 worker 首次扫描等后 16.559s 才就绪。烟测保持 100 次、每次间隔 200ms 的启动探测，跨区域波动容易用尽窗口；前轮连接重置也没有初始化重试。 | 三条独立连接并行初始化；所有连接成功后才启动 worker/listener。仅初始化的 ConnectionReset/ConnectionAborted/UnexpectedEof/TimedOut 最多尝试 3 次，退避 250/500ms。部分初始化失败时等待并释放其他连接；不重放业务写操作。 | 不增加连接总数，不调整连接池容量，不重试权限、证书或任意业务错误。不能据一组耗时断言所有历史超时都只来自该原因，但已确认其是启动脆弱性。 |
| FIX-03 | 初次并发目标测试触发 session pool_size=15 超限；其他轮次发生 TLS 关闭、连接重置。F07 本轮又复现 Node pg 空闲连接 `EADDRNOTAVAIL` 未捕获，进程崩溃且回执遗留 RUNNING。 | 目标作业串行执行；F07 监听并锁存空闲连接错误，立即记 FAIL，成功落盘前再次检查，清理异常也确保结束连接。 | 不把网络故障算业务通过；不对整个带写入的服务验收盲目自动重试。新负例验证锁存后的错误无法转为成功。 |
| FIX-04 | 原启动失败只有 healthz 未就绪，部分日志保留开头而丢失末尾；F06 BFF 握手失败不记录 HTTP 状态，503 易与 401 混淆。 | Runtime 输出阶段、尝试次数、结果和耗时；回执只复制允许的公开字段；日志保留末尾。BFF 添加不含原始错误/身份/凭据的 HTTP timeout/connect、database 错误类别，F06 输出握手状态与脱敏诊断。 | 第二次修复复验的 HTTP 503 发生于 Runtime 启动前，不能冒充 Runtime 回归；该失败保留，后续原始链路通过。未断言该次 503 的底层原因已经被日志证实。 |

## 3. 验证结果

附件索引：[evidence/f06-f07-startup-fix-2026-09-28/index.json](evidence/f06-f07-startup-fix-2026-09-28/index.json)。

| 验证层 | 结果与证据 |
| --- | --- |
| Runtime 初始化负例 | 并行启动、暂时传输错误有限重试、耗尽后拒绝、证书/角色错误不重试、失败后释放其他连接。纳入 Rust 服务测试。 |
| 脚本负例 | 错误 Auth 身份、部分上下文、未批准恢复均在写入前拒绝；日志白名单阻止凭据和未知字段；pg 空闲错误锁存后不能成功。纳入质量自检与 F06 Gate。 |
| 实际 Supabase fixture 恢复 | 2/2（含静态负例）通过，无跳过。实际执行全部恢复 SQL 后回滚临时 fixture，确认无残留；既有用户上下文不变。见 `context-live-tests.log`。 |
| F06 实际身份链 | `runtime-fixed-1.log`、`runtime-fixed-3.log` PASS；真实 Supabase Auth、独立 BFF/Runtime 登录、缺 cookie 401、未知运行 404、跨 Origin 403、角色拒绝 403、注销后 401。第三轮并行连接 2397/2642/7965ms；原有探测和请求超时未修改。 |
| F07 实际业务链 | `f07-precommit.json` 完成 6 项检查：真实 Auth/BFF、调度与 worker、Storage 写入/读取/哈希、另一真实租户的 run/cancel/artifact 拒绝、注销失效。并行连接 4001/5894/6325ms。按既有 L04 规则保持 DIAGNOSTIC_ONLY，临时管理员 Storage key 不等于受限生产凭据验收。 |
| 格式与静态检查 | `cargo fmt --all -- --check`、两服务 Clippy `-D warnings`、脚本语法及 `git diff --check` 通过。 |
| 全量质量自检限制 | 新增 Node 检查已通过；本机没有要求的 Gitleaks 8.28.0，`make quality-gate-self-test` 在该环境前置条件处停止，不能记为全量 PASS。 |

Rust 的未开启数据库开关用例不算目标数据库验收；实际连接证据以上述 Supabase 日志为准。`09c8679` 历史失败 Git notes 保留，不把修复工作树或新提交回执回填给旧源码。

## 4. 重建后的执行顺序

1. 只连接既有、已授权的 Supabase；不运行本地 PostgreSQL/Supabase。目标测试避免同时耗尽共享连接池。
2. `QUANTOS_F06_ISOLATED_PROJECT=1 make f06-test-identity-check`。若确认本次重建清除了既有测试映射，则显式运行 `QUANTOS_F06_ISOLATED_PROJECT=1 make f06-test-identity-restore`；冲突映射仍需人工定位，不自动覆盖。
3. 配置绝对路径 `QUANTOS_TRACE_EXPORT_PATH`，按原有确认开关串行运行 F06 实际服务烟测、F07 目标服务验收。失败回执及日志保留。
4. 提交后冻结新 SHA，补齐该 SHA 的受影响目标回执；推送后再运行其所需 CI/Nightly。当前 main 的总验收结论不自动继承候选修复结果。

残余风险：外部网络或 Supabase 不可用仍会按原条件失败；有限初始化重试不是持续可用性保证。L04 部署入口、受限 Storage 凭据和同地域性能目标继续保留。
