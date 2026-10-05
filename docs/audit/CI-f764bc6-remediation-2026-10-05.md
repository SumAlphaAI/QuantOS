# f764bc6 CI 故障整改与复验报告

检查启动：2026-10-05；最终复验：2026-10-06。源码冻结：`02f26c021470370b8b929c7d899a8eb219bdcf13`。

## 任务完成概况

**5 类 CI 故障均已修复，当前源码的工程复验通过。** F0/A1 21 个节点和 A2 共 22 个 DEVELOPMENT READY；G0/FEP-0 工程检查通过，但新 G0 范围尚待项目用户确认，保持 BLOCKED。新 hosted CI 尚未运行。

原提交 8 个工作流中 5 个失败，原始日志及 URL 保留在 [失败清单](evidence/ci-f764bc6-remediation-20261005/ci-failures.json)。F02 artifact 下载错误是 secret scan 提前终止的连带结果。

## 修复明细

| 工作流 / 模块 | 原因与影响 | 最终修复 |
|---|---|---|
| QuantOS CI / secret scan | 5 条历史 generic-api-key 匹配涉及 3 个公共文件/契约摘要，阻断后续主 CI | 仅精确允许已逐字节核实的 3 个 SHA-256 值；保留全部历史扫描和其他规则 |
| Frontend Baseline / A1 evidence | F04 coverage 被 artifacts/ 忽略，Linux 干净检出 ENOENT | 提交原文件并保持原哈希；仅解除该历史路径的忽略；新 assessor 使用 supporting/ |
| F01 / Webpack fixture | 最小编译夹具缺少实际配置访问的 resolve.extensionAlias 容器 | 夹具提供 resolve={}；仍验证真实可执行字节一致及真实 module ID 碰撞拒绝 |
| F09 / logout trace fixture | 新 LiveState 的未使用 A2 字段要求 CI 未配置的窄角色 URL；raw operator URL 还存在 TLS/CA 差异 | verified TLS/现有 CA 的测试连接；cfg(test) 专用适配器构造未使用 A2 状态；生产窄登录检查保持；先完成连接再创建会话 |
| R01 / supervision evidence | native watchdog 赢得幂等插入，supervisor duplicate，测试只等 supervisor ACK | 同时读取 durable commit evidence 与轮转日志，去重；仅识别两种 producer 的 confirmed insertion；精确 target event_id 读回；纳秒精确时钟与非有限数拒绝；5 秒上限保持 |

## 完成情况与证据

| 检查 | 最终结果与证据 |
|---|---|
| F0 / A1 完整复验 | [86/86 PASS](evidence/provider-a1-remediation-20261004/ci-final-precision-20261006/execution-results.json)，21 个节点内容门禁 READY；含三轮独立构建、真实 Supabase F06/F09、事件持久化/万条事件、F07 恢复、F08 wheel/UDS 和 SCA |
| G0 工程复验 | [16/16 PASS](evidence/frontend-g0-fep0-remediation-20261005/execution-results.json)，新范围用户确认待办，状态 BLOCKED |
| FEP-0 工程复验 | [2/2 PASS](evidence/fep0-remediation-20261005/ci-final-precision-20261006/fep0.json)，8 个直接依赖中 7 READY / G0 BLOCKED |
| R01 CI 连接模式目标复验 | [16/16 PASS](evidence/ci-f764bc6-remediation-20261005/r01-final-precision/receipt.json)，源码 02f26c0，transaction pool，最大异常写入 ACK 3241 ms；测试 actor 已停用，无 pending delivery |
| 原 nightly native ACK 重放 | [原记录及精确 event_id Supabase 读回 PASS](evidence/ci-f764bc6-remediation-20261005/r01-original-native-readback.json)，与 producer 单测共同验证原漏识别路径 |
| R01 producer/时钟回归 | [15/15 PASS](evidence/ci-f764bc6-remediation-20261005/r01-final-clock-tests.log)，含 4 项 producer/精确边界测试 |
| A2 当前内容门禁 | [READY](evidence/bff-fe-001-remediation-20261005/ci-final-precision-20261006/a2.json)，本地语义、8 mutation、22 契约负向、14 阶段正负及真实目标回执通过 |
| 当前实际 CI 消费命令、格式与可移植性 | [PASS](evidence/ci-f764bc6-remediation-20261005/final-verification.json)，所有被引用证据已入 Git；secret scan 检查历史及本轮待提交文件 |
| 最新提交 hosted CI | NOT RUN；本次未推送，不将本地复验记为远端同 SHA 通过 |

冻结前的 [fee7a7f 部分失败轮](evidence/provider-a1-remediation-20261004/ci-fixed-20261005/assessment-interrupted.json)及 [06de767 中断轮](evidence/provider-a1-remediation-20261004/ci-final-20261006/assessment-interrupted.json)均保留且未发布 READY；当前 86/86 来自完整独立最终轮。A2 首次记录因 Node 默认 spec 输出缺少回执要求的 TAP 标记被拒绝，原 [spec 输出](evidence/bff-fe-001-remediation-20261005/ci-final-precision-20261006/contract-negative-spec.log)和[拒绝日志](evidence/bff-fe-001-remediation-20261005/ci-final-precision-20261006/record-attempt-1.log)保留；随后显式 TAP 重跑 22/22 并成功记录，未修改校验条件。

套件范围存在重叠，不合并计算总用例数。F09 普通测试中的 ignored 目标用例不算数据库通过，目标结果来自显式执行。

新 A2 正常二进制目标回归绑定 `fab00ba`：51 次调用覆盖 20 API、14 强断言、cleanupVerified=true；全部 7 个目标源码摘要与最终冻结源码一致。新目标回执独立存放于 [ci-live-20261006](evidence/bff-fe-001-remediation-20261005/ci-live-20261006/receipt.json)，旧 live/回执和旧 A2 manifest 均保留。recorder 只增加受限目标目录参数，内容/依赖/目标断言校验保持。

## 问题与风险分析

原 5 个 CI 故障原因的当前结论见上表。新 hosted CI 尚未运行，只有推送后同 SHA 工作流结果能确认托管 CI。

两次正常 A2 目标轮在首次 MFA 材料交付处出现 503、幂等恢复 restart_required，因无一次性材料无法继续本轮；恢复均通过，未擦除失败。只读提交/审计时间、直接 Auth 响应头延迟及隔离诊断构建单独保留，未确定这两次 503 的具体错误来源；诊断构建不计验收。正常第三轮完整通过，未放宽生产 timeout/重试策略。

R01 默认 session pool 两轮出现实际读/dispatch 超时，失败原件保留。按工作流 transaction pool 设置的最终 16 场景独立通过；不将该注入源/本机服务结果视为真实 Binance、部署、24h 或发布验收。

F07 的恢复/覆盖诊断及临时管理员 Storage 测试身份仅支撑明确 DEVELOPMENT 功能范围；其 P95、部署及正式 Storage 身份验收未据此批准。

原用户确认、历史工程回执、BFF 六项关闭记录保留。功能输入改变后需要新的 G0 范围确认；本轮工程 PASS 不代签用户批准，也不迁移 formal ACCEPTED、签名 notes 或 RELEASE。

## 整改结果与后续动作

当前门禁已重新绑定完整执行的源码、产物与递归依赖。`check:provider-a1`、`check:f0-development`、`check:g0-engineering`、`check:fep0:engineering` 和 `check:bff-fe-001:development` 均通过。工程 CI 对 G0/FEP-0 只接受已验证的“项目用户确认待办”状态，严格 READY 仍拒绝放行；未改工作流的通过条件。

本次未推送。推送最终提交后核对新的 GitHub CI；若仍失败，使用新运行日志定位。G0 新范围文稿见 [不可变文稿](../gate-records/G0-user-confirmation-draft-2026-10-06-52ac593a8a09.md)（范围 `sha256:52ac593a8a096dbae6bd6f1ed708acaf1903539313df1291f66d040818fcd375`），项目用户确认后另行执行正式阶段放行。部署、真实 IdP/provider、发布性能/长稳和同 SHA hosted 回执仍按 RELEASE 的独立要求完成。
