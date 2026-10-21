# ee00c14d Scheduled CI 修复（2026-10-22）

基线：`ee00c14d7ff45ffd976179bd4ee647e06fe84cdc`，从干净 `main` 开始。该 SHA 的 8 个 push 工作流均 SUCCESS；5 个 schedule 工作流中 F05/F07 FAILURE，F08/F09/R01 SUCCESS。本轮只创建本地 Git 提交，未推送。用户随后要求清理测试数据再继续测试；清理维护计划独立记录。

## 原始失败与原因

| 工作流 | 同 SHA 运行 | 失败原因 |
|---|---|---|
| F05 Event Nightly | [39682887828](https://github.com/SumAlphaAI/QuantOS/actions/runs/39682887828) | 数据库/HTTP 测试断言通过；覆盖率检查首先在 event/pg.rs 行覆盖率 85.70% 失败。全源文件合计行 85.32%、区域 77.79%、分支 66.58%；多个持久化适配器低于单文件要求。 |
| F07 Runtime Nightly | [39685903329](https://github.com/SumAlphaAI/QuantOS/actions/runs/39685903329) | 数据库及 gateway 测试断言通过；选定三文件行覆盖率 90.31%，区域 84.00%、分支 81.48%，后两项低于 85%。日志中的锁中毒 panic 来自预期拒绝测试，不是失败根因。 |

Nightly 使用 Rust nightly 的分支覆盖率及真实数据库路径，比 push CI 多了覆盖率门禁。后续增加的市场持久化、授权快照消费、上传恢复和研究事件分页路径没有得到原 F05/F07 测试集的充分覆盖。没有降低阈值、排除源文件、移除断言或更改工作流触发条件。

## 修复范围

- F05 事件：增加市场身份各维度拒绝、原子写入/重复/冲突、撤销 actor、SQL 拒绝后状态恢复、Binance 空页游标与连接健康、事务池 `SET LOCAL` 隔离和失败回滚测试。
- F05 存储：增加冷读快照的来源/符号完整绑定、来源不匹配、时效和质量拒绝、旧/新 lineage 字段、读取权限，以及 wire 元数据身份和持久化投影比对。非法 lineage 由数据库约束拒绝的用例独立验证；将原有范围解析判断原样提取为纯函数，验证数据库防线之外的旧记录防御校验。
- F05 上传：确定性 HTTP 服务覆盖不可变上传的重复/不确定结果、Supabase 两种 Duplicate 响应、非重复失败、真实上传尝试重试与 reconcile、载荷尺寸/摘要和写入身份拒绝。HTTP 服务不替代真实 Supabase Storage 验收。
- F07：研究事件分页直接走 PgRuntimeStore，验证租户/actor/工作流归属、同时间戳事实顺序、增量游标、空页、越界和超过 2,000 条的回放窗口拒绝。
- F05 测试连接器采用与生产适配器一致的 OpenSSL，并正确传递 verify-full 所需的 CA；保持 CI 显式 plaintext fixture 的支持。所有新增持久化测试使用唯一租户，不删除不可变事实。

## 本地验证与边界

本地使用已配置 Supabase PostgreSQL，显式 CA 验证 TLS；未创建本地 PostgreSQL/Supabase、未运行容器数据库、未迁移或重置共享目标。只读探测初次使用错误上传函数签名造成误判，按实际 `(jsonb,jsonb)` 与 `(uuid,jsonb)` 签名核对后确认函数存在；更正记录保留。

Rust 分支测量使用 `nightly-2026-10-21`（`rustc 1.101.0-nightly 19833af72`），与失败的远端 Nightly 相同编译器提交；本地操作系统为 macOS，托管 runner 为 Ubuntu，平台结果不可相互替代。

| 检查 | 实际结果 |
|---|---|
| 修改涉及的 Rust 目标编译、Clippy `-D warnings`、rustfmt | PASS |
| F05 市场事件回归、事务池隔离 | 2 PASS，均实际连接 Supabase，发生只读限制前完成 |
| F05 存储单元/快照/HTTP | 23 + 1 + 4 PASS，快照与上传尝试实际持久化，发生只读限制前完成 |
| HTTP create-only 请求头强化断言 | 1 PASS，无数据库依赖 |
| F07 新增事件分页 | 1 PASS，实际连接 Supabase，发生只读限制前完成 |
| F05 覆盖率检查器自身测试 | 3 PASS，阈值和文件范围未修改 |
| 同编译器 F05 完整覆盖率采集 | FAIL_INFRA：11 个事件单元测试 PASS；事件数据库测试 10 PASS、2 FAIL；目标执行中切到默认只读，10,000 条事件消费及后续租户创建遭 SQLSTATE 25006 拒绝；存储阶段未执行 |
| 部分 F05 诊断导出 | 保留失败执行的实际计数；event/pg.rs 行 94.02%、区域 84.49%、分支 84.09%。这是缺少后续测试的部分数据，不能视为完整门禁 PASS |
| F07 完整分支测量 | NOT_RUN，目标已只读并随后拒绝连接，未继续写入尝试 |
| Git 历史与暂存补丁 Gitleaks | PASS，无新增扫描例外 |

本地完整覆盖率当前状态是 BLOCKED_TARGET_UNAVAILABLE，不能声称 Nightly 已通过。数据库从默认只读转为 SQLSTATE 57P03，控制台确认同一个 QuantOS Test 项目磁盘 96%、Unhealthy，后续还显示 ECONNREFUSED。用户授权清理测试数据后，已完成只读容量/依赖盘点并准备范围冻结和备份程序；尚未删除数据、停用触发器、重置 schema 或重启项目。重启操作被自动审批以“原授权未明确包含共享项目数分钟中断”为由拒绝，已单独请求用户确认，未绕行。

[清理计划](database-test-fixture-cleanup-plan-2026-10-22.md)记录候选识别、逐表备份、事务清理、恢复删除保护和空间回收边界。待项目恢复、备份和清理完成后，仍须重新采集当前源码完整覆盖率，并在推送后复核同 SHA Scheduled。

本轮证据保存原 SHA 工作流状态、原始托管失败日志/覆盖率制品、本地命令输出和失败/中断记录。首次覆盖率诊断在测试修正后主动中断，未记为 PASS；保留错误 TLS 连接器、首事件因果引用、非法 lineage 夹具等失败尝试，完整复验未完成，不把部分导出或此前单项成功拼接为完整 PASS。

[证据目录](evidence/ci-scheduled-20261022/)包含源码和证据 SHA256 清单。候选由包含本报告的 Git 提交与源码清单共同标识。完整 F05 数据库 Gate（含迁移/RLS）、完整 F07 100 次恢复/P95 Gate、真实 Supabase Storage、部署和发布验收均未在本轮重跑；F07 本地覆盖率原计划使用 10 次恢复作为诊断，但因目标故障尚未执行。新提交的 hostedCandidateGate=NOT_RUN，推送后的同 SHA Scheduled 结果仍需复核。
