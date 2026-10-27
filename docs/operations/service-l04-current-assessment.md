# SERVICE:L04 当前服务恢复检查点

2026-10-27，main。当前本地工程 Gate 为 `PASS_OWNED_LOCAL_SERVICE_L04_RECOVERY_CHECKPOINT`，以固定候选 receipt 的采集成功为准。完整 Gate `NOT_READY_GAPS_OPEN`，stage `NOT_ASSESSED`、review `IN_REVIEW`、formalAccepted=false、runtimeAdmission=DENIED。下一原项 `CORE-GATE:L4-SERVICE` 的 DEVELOPMENT 评估允许执行；不放行 I10/testnet 或发布。

## 当前修复与服务入口

`quantos_evidence::local::recover_from_reader` 从已核验 F06 AuthContext 检查精确 tenant/workspace/account/Paper、非空 actor/user、Owner/Operator/Service、ops.read，之后才调用可信 EventReader。PgEventStore 的实现只使用现有按 tenant/correlation 的只读事件查询，不建立连接、读环境、写数据库、重排 outbox、重新签发或下单。此实现编译验证，实际 Supabase 查询/RLS/事务仍 NOT_RUN。数据库宿主须先获得独立授权、使用既有连接与最小角色，完整 portfolio 单流必须自 sequence=1 开始并有外部完整性/最新 head 证明；当前 API 不是有界分页快照或数据库原子恢复协议。

`local::replay` 对完整单租户 portfolio v1 流验证账户、时间、schema、payload hash、序列与来源 ID，再调用真实 X01 apply_recorded。相同事件 ID 的完全一致投递只应用一次；冲突、断档、未来或跨作用域拒绝。受控 F05 AppendOnlyLedger 产生事件及等量审计，但它是内存端口，不声称 DB 持久化。测试从实际 X06 checkpoint 的安全 portfolio events 构造 owned F05 envelope；envelope 的事件 ID 是新 ID，财务 snapshot hash/仓位相同，来源身份不改绑。再次重放同一组 envelope 则完整结果一致。

旧 quantos-evidence 证据模型存在三类真实缺陷：空耗时/矛盾计数可 panic，未完成目标工作量或异常计数可能通过，以及四份同类 drill 可凑成“四类”。本轮拒绝非有限/负耗时、缺项/越界计数，检查确切四类、非空/不重复 checklist。原 `audit_persisted_pct` 改为 v2 的 `audit_signature_coverage_pct`，避免把内存签名计数当持久性证据。`go_no_go_ready()` 固定 false；旧包没有目标/发布授权，局部检查结果只由 `local_checks_passed()` 表达。当前直接调用者只有本 crate 测试；无发布消费者迁移声明。字符串模式检查不称为全面安全审计，旧 fixture MFA 不纳入当前审批验收。

## 四类受控演练与恢复边界

1. Replay：真实 F05 owned 事件编码进入 X01，完整重放及重复投递财务结果一致；部分输入结果不冒充完整结果。
2. Recovery：X06 prepare 后保留 checkpoint，实际 X04 gateway 已提交/Fill，而 owner 未记完成。重建同 gateway 租约实例后禁止重发，只用原身份/原 operation recover_order 读取真实事实。33 次原键恢复尝试保留一次下游提交、一个 Fill 链接。没有重建 issuer/guard/gateway 的跨进程权威，也没有 DB 故障注入或自动重试。
3. EngineFailure：实际 owned failing kernel 接口返回未知传输结果；仅一次调用，进入 Uncertain，换键和原键重发都拒绝，绿色 F09 报告不能清除未知执行告警。不是 exchange HTTP/真实 engine 主机死亡证明。
4. KillSwitch：实际 X06 engage_kill、独立 actor/user 审批恢复、更新健康观察和 kill revision CAS；自批、旧健康和二次消费拒绝，无额外下单。“回滚”指受控恢复授权，不撤销已发生订单/Fill，不改账。

当前额外回归 SERVICE:X06 的 23 个直接服务安全/恢复用例；X05 的 2 个来源/财务测试验证真实 X03/X04/X01 只读适配及黄金账本，另跑 20 类差异定位一项。归档内的 X05 report 使用明确独立 owned golden books，虽作用域匹配，也不宣称是本次执行账户的真实独立账本对账。对完整当前业务链、真实账本来源/累计历史的验收由 CORE:L04/I10 承担。

## 本地审计归档与 F07/F09 证据

`LocalPacket` 保存固定源码、scope、事件与重放结果、命令/订单/Fill 身份摘要、完整 X06 追加 audit 与 head、四类演练、X05 report、F09 health 和安全 trace。校验器重放事件、重算审计链/对账报告，拒绝重复命令/订单/Fill、缺失/过期健康、错误审计 head、矛盾次数和敏感 trace attributes。实际下游调用计数在测试中取自 gateway，不接受客户端授权声明。

`archive` 仅供可信 owner 将安全 evidence 写到可信受限目录，create_new、Unix 0600、文件锁、write_all + file sync_all + 父目录 sync_all；16 个并发发布只有一个成功。失败/半写文件原地隔离，不覆盖、不截断或删除业务记录。verify_archive 需要由可信 owner 独立保管的原始 digest，并核对大小、普通文件、内容与语义；不能把文件自身 checksum 当成来源授权。路径/父目录防替换与权限由宿主负责，非 OS sandbox；当前读取可阻塞在协作文件锁，宿主须使用任务 deadline。容量限 8MiB/4096 records/4096 audit；达到上限拒绝，不冒充无限历史归档。

实际新增 `l04-evidence --verify-owned-local-archive <path> <trusted-digest>`，env_clear 的新进程只读验证原 archive，输出 `executionAuthority=false/runtimeAdmission=DENIED`；无 DB/环境凭据/网络，也无执行恢复接口。本地 archive 写出前的全部 audit 与新进程读回条数一致，此样本可称“本地证据审计完整落盘”，不能称通用业务 ledger/outbox/audit 数据库持久化 100% 或跨重启交易恢复。

F07 取真实 F05 owned event/audit 计数并沿用现有受控 X05 差异定位；没有运行数据库 campaign。F09 使用实际 build_health_report、OperationsService.observe/health、JsonlTraceExporter export/query。归档保存安全 trace；没有真实监控部署、推送通知或持续窗口声明。

## 执行、风险与移交

先提交当前源码，再运行 `node scripts/service-l04-review.mjs --run docs/audit/evidence/service-l04-local-20261027/attempt-NN`。采集白名单环境、Cargo locked/offline，禁止覆盖 attempt；失败/中断保留。`--verify` 只读校验原候选和当前输入，证据提交不改绑源码。影响范围限新恢复/证据代码、旧报告修复与上述直接服务/对账回归；不跑全仓、覆盖率、依赖 Gate 全闭包或数据库 campaign。

秘密扫描仅任务差异与当前 attempt，沿用精确且未改的公共 F06 幂等值例外，并实际拒绝 2 条反例；不是全仓安全评审。性能/长稳和远端同 SHA CI 不纳入本地通过。

保留 NOT_RUN：实际 Supabase event/audit/outbox/一致读与 RLS/角色、数据库恢复/多副本事务/锚保管/崩溃窗口、跨进程交易状态重建、真实来源对账、公共 BFF/UI/testnet、目标部署和主机死亡通知、目标负载、完整安全/长稳/同 SHA CI、正式用户确认及发布。历史 X05/X06/L01/L02/L03 证据仅 ORIGINAL_SCOPE_ONLY，不改绑新候选。没有生产凭据、push、外部交易或发布。[证据包](../audit/evidence/service-l04-local-20261027/README.md)。
