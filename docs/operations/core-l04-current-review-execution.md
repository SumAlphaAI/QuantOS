# CORE:L04 DEVELOPMENT / L4-CURRENT-REVIEW-EXECUTION-01

本轮仅接当前风险 Subject 的独立审批到本机 owned mTLS 受限执行。工程实现待验收；完整 Gate NOT_READY_GAPS_OPEN、stage NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED、M5 PREPARED_NOT_READY，19 gap/8义务保持 OPEN，159规范阶段和原分母不变。实际来源/身份/目标数据库/Vault/testnet/发布未执行，不使用生产凭据。

## 来源与执行

旧 submit 接口拒绝 native risk Subject。新 owner-only submit_current 只接受与 X02 签名来源完整相等的 NativeRiskContext（不仅比 hash），在审批、来源及 RiskGuard 锁下重核原 Proposal/两次独立 MFA/当前 session、kill generation、C11 相同版本/head/有效期。BFF 在外层审批持久锁下同步实际 X01 账本，并持有认证估值输入的稳定 OS 锁直到原生 IO 完成；客户端只能提交 expectedRevision，不能上传价格、现金或执行上下文。

原生 fsync checkpoint 在 IO 前同时预留 Proposal hash 和当前 snapshot hash；一次快照只允许一个新命令，即使换 Proposal/决定/审批申请也不能重复花费其预算。当前源单次预算是保守边界；不是多账户/跨主机或一般 open-order 风险预算。新命令 MAC 独立域绑定原审批、Subject、command ID、原最小截止以及 snapshot/ledger/source/version/generation、decision/Proposal、C11 lease 与精确 notional。冷恢复校验签名、claim 对应关系与 immutable high water；旧命令不重签，原格式空 snapshot claims 的 reservation anchor 保持兼容。整个 owner 目录/密钥一起回滚仍需外部单调锚验收。

默认 currentReviewExecutionEnabled=false，仅私有 owned reference 配置可显式打开。live 未挂载，公开页面开关不能授予该权限。实际成功样本先经 BTC 原生 Fill 入账，再从当前 BTC 账本/显式独立参考 mark 得到精确估值。独立 S03 参考发布（BTC/ETH universe，真实模块检查与审批）产生尚无决定/Subject 的不可变 ETH R04 候选；它只能经当前原限额评估得到新签名 ApprovalRequired，创建零审批的新 Subject，再由两名不同操作人 MFA 审批。原 BTC 策略/Proposal/风险限额不改；未登记 universe 的 ETH 如实拒绝。参考 mark/现金不是实际金融来源验收。

## P11 与 UNKNOWN

P11 只有新 Subject 双审批且 owner 条件允许才显示显式危险动作。提交前重读当前身份、审批及估值绑定；Command 返回值逐项绑定 Subject 的原风险来源。当前命令响应丢失后仅 GET 查询原 request，不再次 POST；尚无命令记录时保持未决，禁止换 key。UNKNOWN 回执只读，原签名、generation、snapshot/Proposal claims、隔离和 OPEN Alert 保留；不补发、不重评预算、不自动关闭。旧 legacy response-loss 流程保持原 key/body/CSRF 绑定，不据此放行当前风险命令。

## 验证与移交

[当前范围](../execution/core-l04-current-execution-scope.json)、[原始证据与封存](../audit/evidence/core-l04-current-execution-local-20261029/README.md)。仅运行当前功能和直接相关来源、审批、恢复、账本/审计/kill/C11、UI、契约、类型/静态及 Chromium；不递归重跑全部上游、不运行 F05/F07 campaign 或目标数据库。

原始 preflight 保留请求键格式拒绝、策略 universe 拒绝、cold candidate 初始化冲突、测试时间模型、旧 inventory/example 漂移及浏览器夹具调用失败。修复后必须冻结源码，使用新 attempt 验证；失败不抹除、不计 PASS。PRE-04 同步八项已有发布操作、当前版本/模型/字段与当前 provider 文件摘要；schema example 仅为说明（沿用历史原范围公开投影），不重绑历史工程验收。

下一任务：CORE-GATE:L4 DEVELOPMENT，评估当前组合和剩余缺口。正式验收文稿待用户确认，不能自行批准；integration/release/真实环境权限均不提升。

最终复核发现：初版 owner 当前执行开关开启后，旧 Subject 在新 Deny 后仍显示可提交，服务端始终拒绝新 IO。新增直接回归探针真实 FAIL 已保留；修复为旧 Subject 始终受 currentRiskReviewOnly 围栏，新 native Subject 仅按独立当前开关核对。首个冻结 attempt-01 的21项原预期结果仅 ORIGINAL_SCOPE_ONLY；不得据此宣称本次修复通过，新源码使用 attempt-02。
