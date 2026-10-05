# BFF-FE-001 问题整改与复验记录（2026-10-05）

原始复审：[初审归档](BFF-FE-001-findings-archive-2026-10-05.md)；当前结论见[检查报告](BFF-FE-001-comprehensive-review-2026-10-05.md)。保留原报告、6 项 OPEN 发现、失败及反证证据；本文件登记修复后的状态，不改写历史。

## 一、整改范围与状态

本轮按 H-01 → H-02 → M-01 → M-02 → M-03 → M-04 处理。仅评估 A2 身份、会话与 Web 设置 API 的 DEVELOPMENT 范围；PROVIDER:A2/ALL、G1、Desktop、staging、远程同 SHA CI 与 RELEASE 人工确认分别验收。

本轮 **6/6 问题 CLOSED**（高危 2、中危 4），活动问题 0；原 24 控制点从 18 PASS / 3 PARTIAL / 3 FAIL 升至 **24/24 PASS，实际完成率 100%**。C01/C17 的 20 个 API 从 14 PASS / 4 PARTIAL / 2 FAIL 升至 **20/20 PASS**。严格 DEVELOPMENT runner 核验当前内容后登记 **READY**；`formalAccepted=false`。此结论仅限上文 A2 范围。

实际运行及目标测试源码提交：`9d67f880fb2b6532114f3f7b7e46ecf952176e1f`；派生元数据修正提交：`36ae257d8a7f0e9e0a60761f1288373bf353470d`。证据提交仅新增回执/报告并更新阶段字段；本阶段按功能输入内容摘要验证，不宣称最终文档提交的同 SHA hosted CI 或 RELEASE 验收。



| 控制点 | 核对项 | 修复前 | 修复后 | 关闭依据 |
|---|---|---|---|---|
| R01 | C01/C17 20 operation 发布 | PASS | PASS | 原满足项，本轮回归维持 |
| R02 | OpenAPI/TS/Zod/MSW 同源 | PASS | PASS | 原满足项，本轮回归维持 |
| R03 | P01/P15/owner/二期边界 | PASS | PASS | 原满足项，本轮回归维持 |
| R04 | A2 live provider 可运行与覆盖 | PASS | PASS | 原满足项，本轮回归维持 |
| R05 | session/context 与恢复 | PASS | PASS | 原满足项，本轮回归维持 |
| R06 | profile/locale/theme 保存读回 | PASS | PASS | 原满足项，本轮回归维持 |
| R07 | 通知偏好保存读回 | PASS | PASS | 原满足项，本轮回归维持 |
| R08 | If-Match/版本冲突 | PASS | PASS | 原满足项，本轮回归维持 |
| R09 | challenge 生命周期 | PASS | PASS | 原满足项，本轮回归维持 |
| R10 | MFA 失败限流/冷却 | PASS | PASS | 原满足项，本轮回归维持 |
| R11 | recent-auth/首因素授权范围 | FAIL | PASS | H-01 |
| R12 | logout/cookie/CSRF/Origin | PASS | PASS | 原满足项，本轮回归维持 |
| R13 | 匿名访问申请 | PASS | PASS | 原满足项，本轮回归维持 |
| R14 | 安全/会话/设备/下载/平台读取正确性 | FAIL | PASS | M-02 |
| R15 | 当前会话/最后有效因素保护 | PASS | PASS | 原满足项，本轮回归维持 |
| R16 | 幂等响应与观测/审计关联 | PARTIAL | PASS | M-01 |
| R17 | 设备/因素撤销与注册幂等 | PASS | PASS | 原满足项，本轮回归维持 |
| R18 | 撤销 SSE/实时失效 | PASS | PASS | 原满足项，本轮回归维持 |
| R19 | 401/403/404/资源主体约束 | PASS | PASS | 原满足项，本轮回归维持 |
| R20 | consumer runtime schema/default deny | PASS | PASS | 原满足项，本轮回归维持 |
| R21 | 错误恢复/超时/取消 | PARTIAL | PASS | M-03 |
| R22 | A2 正负 Gate 的实际业务退化检出 | FAIL | PASS | H-02 |
| R23 | CI 接线/前置功能准入/输入绑定 | PARTIAL | PASS | M-04 |
| R24 | 版本/总结/历史与验收边界 | PASS | PASS | 原满足项，本轮回归维持 |

逐接口前后状态及每项证据路径保存在 closure.json；PASS 仍按原报告等权口径计 1，PARTIAL/FAIL 计 0。

## 二、逐项修复及验证

| ID | 修复内容 | 复验标准 / 证据 |
|---|---|---|
| H-01 | 主体锁内重新读取 Supabase 因素；已有任一已验证因素时 first_factor 不允许新增；已完成命令重放与既有因素的待完成恢复保留；当前 verified 状态覆盖取消检查点 | 双会话真实负向、新注册命令未创建、因素数量不增加；原 key 重放、已有因素恢复；缺省因素兼容与畸形因素拒绝 |
| H-02 | 实际 live 路径使用独立策略单元，进入执行语义门禁；增加实际策略的 5 项 mutation，保留 reference 3 项；严格阶段门禁同时绑定 live handlers 与真实目标证明 | 14 Rust 单元断言通过（另 1 项目标测试默认 ignored）；reference 12 项；8 项 mutation 均由业务断言拒绝 |
| M-01 | 资料/偏好命令持久保存私有 correlation；响应去除私有字段；重放沿用；MFA verify、reauth 的 audit/响应/trace 用同一 ID；会话/设备撤销事件沿用命令 ID | 真实响应 ID 查到唯一 DB audit，并查到成功 trace；重放 ID 固定；SSE correlation 与撤销命令一致 |
| M-02 | lastVerifiedAt 取 Supabase last_sign_in_at 与持久 mfa.verify 审计成功时间的最新可信值；无事实时返回不可用；保留 DateTime wire 契约并同步说明与生成物 | MFA 前主认证时间、MFA 后持久成功时间；缺事实单元约束；契约/生成漂移验证 |
| M-03 | 默认 30 秒超时覆盖响应头与 JSON body；可配置 deadline 与调用方 signal；bundle 依赖失败取消兄弟读取；写操作不自动重试，结果未知有明确错误类型 | 29 consumer 测试含停滞头/body、预取消、运行中取消、401 组失败、网络错误净化和原 key/版本/草稿恢复；既有 HTTP 409/429/503 回归保留 |
| M-04 | 新增内容绑定 A2 manifest 与严格 runner，绑定语义日志、8 项 mutation 日志、20 API 目标实测/清理/trace、递归上游 READY；CI 接线与 14 项反证 | `pnpm check:bff-fe-001:development` 与 `pnpm test:bff-fe-001:development`；陈旧源码/目标证据、缺断言、清理未核实、上游失效必须拒绝 |

安全修复先经过独立边界调查，再经过独立候选补丁复核；候选复核发现 Supabase 因素字段省略的兼容性回归，已修复并纳入测试。正常无因素用户须包含可信用户 ID；字段存在但类型错误/因素畸形仍失败关闭。

## 三、证据、执行与恢复

完成统计：控制点 PASS 24 / PARTIAL 0 / FAIL 0；接口 PASS 20 / PARTIAL 0 / FAIL 0；问题 CLOSED 6 / OPEN 0。机读统计见 [closure.json](evidence/bff-fe-001-remediation-20261005/final/closure.json)，本节点内容绑定证明见 [a2.json](evidence/bff-fe-001-remediation-20261005/final/a2.json)。

本轮证据目录：[bff-fe-001-remediation-20261005](evidence/bff-fe-001-remediation-20261005/)。本地无数据库测试与实际 Supabase Auth/PostgreSQL + 本机 live BFF 分开记录。凭据来自工程已有配置，不写入报告/日志。受控目标测试仅修改现有测试主体及本轮临时记录，finally 恢复资料/偏好、原因素集合并清理临时会话；追加测试审计保留。

最终 [目标 receipt](evidence/bff-fe-001-remediation-20261005/live/receipt.json) 在受检源码上执行 52 次调用、全部 20 API、14 项强断言，`cleanupVerified=true`；源码摘要全部与当前文件一致。5 个响应 correlation 均查到对应唯一 DB audit 和成功 [trace](evidence/bff-fe-001-remediation-20261005/live/traces.jsonl)，撤销事件沿用命令 correlation。资料/偏好、因素集合和本轮 BFF 会话已核实恢复/清理。`lastVerifiedAt` 在未 MFA 时表示主身份认证时间，不表示 MFA 已成功。

失败与过程证据均保留：最早恢复夹具的 JSON 参数序列化错误在 `live-failed-fixture`；冻结前/Clippy 修正前的过程通过记录在 `live-pre-freeze`、`live-pre-clippy`，均不用于最终准入。一次最终实测在目标准备阶段异常终止（日志最终为 unsettled top-level await，未取得完整初始错误）、没有 receipt，日志归档于 `live-failed-initial-connection`，当时尚未启动 BFF、未产生本轮修改，未计 PASS；同源码重试后才获得最终通过和清理核实。第一次上游复验的 F06 预检连接中断及新增 transport 测试 NodeNext 导入错误保留于 `provider-a1-remediation-20261004/a2-revalidated-20261005`，修正导入后在受检源码完整重跑，不拼接失败轮结果。

## 四、阶段依赖与后续边界

A2 必须消费 BFF-FE-000、CORE:F06、PROVIDER:A1 的当前有效 READY。原上游功能策略绑定全部 scripts/workflows 和 client 输入，本轮代码变更使旧回执失效；在运行源码提交上完整执行 65 项检查，最初 **63 PASS / 2 FAIL**；两项失败均为 PRE-04 的旧 OpenAPI 派生摘要。通过结果包含三次独立完整构建、F06 实际目标、F05 目标数据库/10,000 事件链、Storage/RLS，以及本地构建、测试与覆盖率。只修正 `PRE-04-inventory-baseline.json` 的 `openapiDigest` 后，逐字节对比全部捕获输入，确认其余功能输入未变、OpenAPI 仅变更 lastVerifiedAt 说明且 wire 结构不变；保留 63 项原执行结果，重跑 PRE-04 正向及 38 项负向，得到 **65/65 有效通过结果**。详见 [当前执行台账](evidence/provider-a1-remediation-20261004/a2-metadata-revalidated-20261005/execution-results.json)及[输入比对与选择性复验记录](evidence/provider-a1-remediation-20261004/a2-metadata-revalidated-20261005/revalidation.json)。原 63/2 失败轮完整保留，不宣称 65 项都在元数据提交上重新执行。14 节点依赖链及 A2 本节点，共 15 节点已刷新 READY。

G0/FEP-0/F0 的既有人工确认和历史功能证据不因本轮修改自动迁移。其余受影响的 CORE:F02/F07/F08/F09、TP01-A/B、CORE-GATE:F0，以及 FRONTEND-GATE:G0/MILESTONE:FEP-0 当前仍为 NOT_ASSESSED；A2 的关闭不自动放行 PROVIDER:A2/ALL 或 G1，也不是 RELEASE 批准。

最终复验：本地语义、8 项 mutation（5 项实际 live 策略）、22 项契约负向、14 项阶段正负、3 项 transport 辅助测试、工作区规范/类型/构建/测试、目标证据及严格递归门禁通过。source/code drift、上游不 READY、失败/缺失证据、缺清理或 trace 关联仍拒绝准入。
