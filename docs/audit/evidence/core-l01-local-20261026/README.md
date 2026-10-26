# CORE:L01 当前本地协议适配证据

2026-10-26，在 QuantOS/main 完成。固定实现候选 **decf787ff12e1caa2917ad2fd9fcfa8b9496d0b9**，原始结果 **attempt-01**；证据提交保留该绑定，不把结果改绑后续 HEAD。[功能规程](../../../operations/core-l01-current-function.md)、[变更文件](./changed-files.md)、[命令与结果](./commands.md)、[兼容报告](./compat-report.json)、[机器回执](./receipt.json)、[待确认文稿](./acceptance-draft.md)。

工程 Gate：**PASS_OWNED_LOCAL_L01_PROTOCOL_ADAPTER**。完整 Gate **NOT_READY_GAPS_OPEN**；DEVELOPMENT stage **NOT_ASSESSED**，development_status **IMPLEMENTED_PENDING_ACCEPTANCE**，formalAccepted=false，runtimeAdmission=DENIED。正式确认待定，不更改上游或既有验收状态。

| 检查 | 结果及范围 |
| --- | --- |
| 当前功能 | protocol 15 + legacy-current 6 + real-process 1 = 22 passed；包括实际 X03 签发→SignedExecutionGateway→协议内核→X04 Fill、未知写不重发、恢复、精度/有效期/限流和回包原子拒绝。 |
| 直接影响回归 | 旧 venue 4 + gateway 15 + TP07 dispatch 8 + X04 OMS 8 = 35 passed；合计 Rust 57 passed / 0 failed / 0 ignored。100k 性能项显式跳过，其余过滤项不计通过。 |
| 200 条自有协议样本 | 五类参数化输入：50 完全成交、50 部分成交、50 拒绝、25 撤单、25 撤单拒绝。直接端口与真实 stdio 各映射 200/200，各 250 次调用；是同一批 200 样本的两面回放，不是 400 独立业务场景。 |
| 事实/幂等 | 进程面逐条事实 anchor 和 X04 回放，重复提交零新增协议写；只证明同一内核租期。 |
| Node | 63 passed / 0 failed / 0 skipped：L01 范围/矩阵/边界/秘密形状拒绝 39 + development-execution 24。 |
| 编译/静态 | quantos-evidence 直接消费者仅编译；当前执行包严格 Clippy --no-deps、fmt、局部 ESLint、计划校验均通过。 |
| 测试制品 | 自有 fixture 与当前 attempt 文本扫描 0 凭据形状/生产端点命中；真实子进程 env_clear。不是全仓秘密审计或真实凭据隔离部署验证。 |
| 准入 | CORE:L01 INTEGRATION exit=1 / STAGE_NOT_READY 为预期拒绝；CORE:L02 DEVELOPMENT allowed=true。 |

协议实现只有固定 testnet origin 和无凭据端口，当前执行 profile LIMIT/GTC。使用 Decimal::from_str_exact，签发金额/限价不静默改变；tick/step/min-notional/有效期来自自有 owner 规则。403 独立访问拒绝，认证/限流/业务拒绝分别分类。5xx、超时、断连、未知/矛盾回包保留未知，不把网络失败记成交所拒单，也不自动重发。查询恢复核对订单与逐笔成交/费用，过量/改写/未来/外来帧整批拒绝。旧适配器保留 fixture 兼容，不能作为真实执行权限通路。

[preflight-01](./preflight-01/legacy-boundary.log) 3 失败保留原始结果；[preflight-02](./preflight-02/l01-tests.log) 为开发期 22 通过，未冻结完整源码，不计最终候选验收。详细修正与工具失败见 [开发记录](./development-notes.md)。attempt-01 当前命令全部符合预期，不拼接旧通过。

未决：HTTP/TLS/HMAC 与受限凭据宿主、真实 exchangeInfo 全过滤器/时钟/账户-IP 权重限制、trade 分页与 reset/数据流、跨重启/多副本持久去重及未知状态恢复、C09/共同持久审计/完整业务联调，均 NOT_RUN。原目标 200 笔真实 testnet、目标 Supabase、目标安全/性能/长稳/同 SHA 远端 CI/发布验收均 NOT_RUN。当前样本不是交易所回执，没有生产凭据、数据库或外部 testnet 调用，没有推送或发布。

下一可执行原任务：**CORE:L02（Supabase Vault、mTLS 与受限执行区）** 的本地功能实现；目标数据库/真实受限环境操作仍需明确环境授权。未递归重跑上游 Gate、F05/F07 campaign、全仓测试或三轮独立构建。

只读复核：`node docs/audit/evidence/core-l01-local-20261026/verify.mjs`。二进制摘要核对需要保留当前 `target/debug/examples/l01_fixture`；重建必须使用固定候选/离线工具链，摘要不匹配应拒绝，不能自行覆盖历史证据。
