# CORE:X06 当前执行、审计与运维 Terminal 功能证据

2026-10-26，在 QuantOS/main 完成当前功能修复、原生/consumer/实际浏览器组合及分阶段状态校验。最终候选与结果以 receipt.json 的 sourceCommit / attempt-04 为准；本目录后续证据提交不改变源码绑定。[执行规程](../../../operations/core-x06-current-function.md)、[命令结果](./commands.md)、[变更文件](./changed-files.md)、[待确认验收文稿](./acceptance-draft.md)。

**工程 Gate：PASS_OWNED_LOCAL_X06_EXECUTION_AUDIT_OPERATIONS。** 完整业务联调仍 PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS / NOT_READY_GAPS_OPEN；CORE:X06 stage_gate 为 INTEGRATION NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。计划 development_status=IMPLEMENTED_PENDING_ACCEPTANCE。未修改任何上游历史 READY、用户确认或 X3 完整清单。

## 当前结果

| 验证 | 当前结果及适用范围 |
| --- | --- |
| Rust | 94 passed，0 failed/ignored：OperationsService 23、3 编译拒绝契约、BFF execution 28、BFF operations 22、audit core 4、audit/export provider 14。过滤出的上游用例未记通过 |
| Web consumer | 18 文件，280 passed，0 failed/pending；Audit runtime 26 项含本次新增 8 项 |
| 门禁/路由 | Node 83 passed，0 failed/skipped；拒绝状态伪提升、错误页面集合、虚假链/水印/外部请求/性能接受 |
| Chromium | 21 passed，0 failed/skipped/flaky，retries=0、workers=1：新 X06 3、Audit 6、执行/恢复 5、运维治理 5、P08 风险 2 |
| 静态/构建 | Terminal typecheck、局部 ESLint、当前 Terminal 静态导出、两份计划结构/顺序通过；receipt 绑定全部导出文件摘要 |
| 阶段 | CORE:X06 INTEGRATION 按预期 exit 1 / STAGE_NOT_READY；下一 CORE-GATE:X3 DEVELOPMENT allowed=true |
| 无障碍 | 同实例 Audit 页面自动 axe 1 次，0 violations、1 incomplete；截图人工查看，不代表人工无障碍验收 |

同一 BFF 实例由 Operator 读取 Portfolio/Proposal，实际 C07 风险提交后独立 Approver 在 P10 完成 MFA/审批；Operator 在 P11 提交与撤单，故意丢失已提交回执后显式恢复。三对请求保持 key/body/version/responseHash 一致；最终 UI 显示 cancelled，Paper venueKind=mock、fills=[]。随后按相同 correlation 读取 C10 四节点完整链，浏览器实际下载原始 JSONL 水印内容并核对长度/SHA-256；在同一进程执行 C11 InspectHealth，切换 reference Owner 查看 P14 能力目录。新网络回执的 externalRequests 均为空。x06-cross-page.json 内 order 是撤单前 accepted 快照，最终 cancelled 由 g8-journey.json 及 UI 断言证明，不把先前快照改写为终态。

Audit 修复覆盖：首次权限集合和最短有效期固定；每次高风险导出前重读 C01；401/403（含非 JSON）及本地访问监视器失效立即清除事实/分页/未知意图；暂时 C01 503、限流、小屏拒绝不自动丢失原键，恢复必须显式且内容相同。C01/业务写入错误不自动重放；导出下载 URL 不作为页面/存储/证据状态保存，网络 ticket/signature 脱敏。

## 来源、失败与适用性

- 基线 HEAD：9a02807f。源码提交依次 ae66bbac（实现/测试/规程）、15bb5691（测试类型及实际 Operations 用例选择）、27319928（改选当前 P08 回归入口）、1a7e745b（本地监视器失效立即清除）。命令与完整 SHA 见 receipt / changed-files。
- preflight-01：基于基线、未提交测试增量，新增 4 项失败，18 项筛选排除；证明旧实现授权迁移/租约延长/401/403 未知意图残留问题。preflight-02：中间修复 20 pass/2 fail，暴露旧请求计数预期及冷却误清除。两组不是冻结候选验收。
- attempt-01（ae66bbac）：consumer 279 pass，但新测试回调缺少显式 undefined 令 typecheck exit 2；后续命令 NOT_RUN。Operations --lib 仅 0 项，未冒充 23 项通过，后改用实际 service_x06。
- attempt-02（15bb5691）：前 19 个浏览器场景通过；选错旧 UI501 内联确认表单入口，两场景等待“确认短语”超时，结果 2 failed。截图/页面状态/网络及 failure.json 原样保留。改为仓库现有 P08 DangerConfirm 场景，仍验证取消零请求、Operator engage、Owner-only release 403 及已提交响应丢失原键恢复，未降低行为断言。旧 UI501 剩余场景未执行，也不记通过。
- attempt-03（27319928）：原范围 94 Rust / 279 consumer / 83 Node / 21 Chromium 全部通过；原始 receipt 保存为 prior-attempt-03-receipt.json。收尾审查发现本地 monitor 在 C01 reload 中失效仍残留 uncertain，preflight-03 新测试 1 failed（25 筛选排除），随后修复。历史通过只保留原范围，不改绑本次最终候选。
- attempt-04（最终候选）：因实际 Audit 产品边界修复，重建 Terminal 并完成当前同一影响范围；原始命令/时间/退出码/日志、source inputs、二进制摘要、下载 bytes、网络、截图均独立保存。未运行全仓测试、三轮独立构建要求或 F05/F07 campaign，未递归重跑上游 Gate。
- 工具前置的一次非白名单 pnpm 调用尝试查询 npm registry 并失败，未形成测试通过结果；正式记录器统一使用已固定 pnpm 的白名单环境和 offline 设置，无生产配置继承。

## 未决风险与下一步

reference cookie/MFA bridge、loopback TLS/CORS、内存进程均为显式测试替代；无真实 IdP、数据库/RLS、持久 ledger/outbox/交易原子性、跨进程恢复证明。C09 Paper 与 C11 观察来源独立，InspectHealth 成功不代表共用 ledger；InspectEvidence HTTP 正向缺少共同证据来源，resolve HTTP 正向缺少受控修复入口，均 NOT_RUN。P13 七服务/完整遥测、P14 全量签名元数据/历史/审批/导出/领域实时流有缺口；身份撤权流不等于业务实时流。历史 G4/G5/G6 未在此整体准入。

原“任意订单 ≤5 分钟还原证据链、订单/审批/kill E2E 100%”指标保留，elapsedMs 只是本样例诊断。完整业务联调/浏览器/人工无障碍、性能/长稳、真实目标数据库/venue/testnet、部署、远程同 SHA CI 和发布 NOT_RUN。未创建数据库、未用生产凭据、未推送或外部发布。

下一可执行原项：**CORE-GATE:X3 当前执行与治理业务闭环评估（DEVELOPMENT）**。它需独立处理完整闭环清单，不凭此工程结果宣告 X3/Beta 通过。

复核：`node docs/audit/evidence/core-x06-local-20261026/verify.mjs`。该命令仅校验当前源码与不可变证据，不执行引擎、SQL 或外部操作。
