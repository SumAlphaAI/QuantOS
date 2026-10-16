# CORE-GATE:S2-SERVICE 本地功能准入验收报告

2026-10-16；分支codex/s2-service-gate，任务基线2f79964af09769f3a6a88bb59d336de2a0053747，冻结功能候选 `2d42eab461ce0294e67bedb6cf40bb2e60f3ce06`。13个直接前置、完整39节点，全部127组实际执行PASS，38依赖节点/124组先于本聚合3组。没有拼接历史READY。三次独立构建、make lint/test PASS；Rust414 passed/11 ignored，Python1856 passed，Web233 passed/3 skipped。条件数据库用例NOT_RUN及ignored/skipped不是目标验收。自身反例47项、门禁73项，共120项通过。

## 实现和本地行为证据

新增S2聚合profile、严格同候选证据组合器、门禁和记录器，验证精确命令/执行顺序、状态/退出/超时/信号/执行时间、raw日志与Artifact/supporting字节hash、输入摘要和source SHA。所有124依赖执行完成前不能生成聚合证明；未知、缺项、重复、重排、失败、跨attempt路径、历史/混SHA、字节篡改、目标/正式/生产声明均拒绝。重复公共检查仅在本轮同候选内按ID去重，各节点仍有完整必要检查集合。

R1 research proposal-matrix/consumption/order-denial三个产品及4组suite，TP01 A–G/取消/Artifact去重/禁用和回滚，S01 50组并发编辑/隔离/Artifact复核，TP06 100恶意提示与100静态失败阻断，S02 10一致重放/100泄漏拒绝及成本/滑点/参数/环境绑定，S03不可变Release/100未验证未审批拒绝/20路审批CAS/Paper-Shadow消费，以及S04真实本机TCP→生成Artifact→草稿→回测→Release→审批→两个原生消费者→hash审计链，均从本轮实际输出重算。真实本机TCP/UDS不能证明目标持久化、操作系统隔离或真实venue交易。

TP08–TP11重新生成本地参考评估并核对源码/输入、typed映射、无运行时依赖及LOCAL远程NOT_RUN。它们原始整体READY/BLOCKED状态原样保留，不改写为独立准入；consumer-local证明只归S2所有。TP07/TP12同候选重新评估：固定源/许可/SBOM/CVE快照、capability边界，7禁止耦合规则/6接口/8威胁；runtimeAdmission=DENIED。TP07已有56 advisory ID及47个非registry未知项和TP12未执行CVE审计保持开放；离线重放不刷新远程漏洞、许可或数据授权结论。

## 计划、证据和历史保护

两份计划、排序/回执策略、Beta移交和Makefile已同步，只发布本聚合DEVELOPMENT READY；共享功能输入变化使TP12旧独立READY撤回，04dc1965/2f79964a历史证据保留。上游组件不发布独立READY，全图1 READY/158 NOT_ASSESSED/0 BLOCKED。CORE:TP12完整任务卡仍在X3，依赖CORE:TP07和S2，不被此处参考评估替代。

[完整变更索引](./evidence/s2-service-local-20261016/changed-files.json)、[聚合manifest](./evidence/s2-service-local-20261016/manifest.json)、[摘要](./evidence/s2-service-local-20261016/summary.json)、[实际聚合输出](./evidence/s2-service-local-20261016/aggregate-evidence.json)。[全部执行结果](./evidence/provider-a1-remediation-20261004/s2-service-local-20261016/attempt-01/execution-results.json)、[完整依赖顺序证明](./evidence/provider-a1-remediation-20261004/s2-service-local-20261016/attempt-01/dependency-revalidation.json)、[canonical恢复](./evidence/provider-a1-remediation-20261004/s2-service-local-20261016/attempt-01/canonical-preservation.json)：637个原始文件、15个目录的字节和存在性已恢复；生成delta另存，不覆盖历史。

[预检](./evidence/s2-service-local-20261016/preflight/index.json)保留首轮113通过/1失败：聚合器误要求参考回执整体READY，修正为工程PASS并保留BLOCKED/远程NOT_RUN。最后120项、共享54项及计划/交接/秘密扫描通过。UNIT_ONLY样本为固定归一化结构/摘录，只用于回归测试，摘要字段不是有效验收证据；实际聚合拒绝历史attempt路径，只消费本轮真实输出。[收尾检查](./evidence/s2-service-local-20261016/post/checks.json)记录本地门禁、发布拒绝、计划/交接、格式及秘密扫描。完整attempt-01未失败或复用历史通过组。冻结后只改计划状态、audit报告及证据；功能输入保持不变。

## Gate、未决风险和下一任务

仅 **S2-SERVICE_LOCAL / DEVELOPMENT READY**，engineeringStatus=PASS，formalAccepted=false。[六维用户确认文稿](./evidence/s2-service-local-20261016/confirmation-draft.md)PENDING；按项目规程等待ProjectUser直接确认，未自行生成签署或原始答复。上游运行时DENIED，CORE:TP07/TP12完整X3、页面/G3、Beta/生产未放行。

全部22组继承目标义务及4类移交NOT_RUN：实际Supabase/RLS/身份与持久事务、跨进程审计/Artifact/审批/恢复、真实部署时钟/镜像/进程和凭据隔离、live数据/模型用途及法律分发授权、最新供应链/CVE/可达性/修复、实际成本校准/安全/负载/性能/长稳、连续7天canary与目标回滚≤300秒、同SHA hosted CI和正式确认。S04页面/P06/P07/20 UI fixture和S2业务联调归CORE:S04/FRONTEND-GATE:G3，公共BFF映射归BFF-FE-004。未使用生产凭据、未建立本地PostgreSQL/Supabase、未推送Git或执行外部发布。

下一可执行：**CORE:X01：Portfolio读模型与风险输入快照**，按任务卡先对CORE:F05、CORE:R01和本S2聚合做新候选完整依赖复验，再完成读模型/rebuild/migration及本地证据；目标Supabase和性能继续独立验收。CORE:TP12完整复审继续保留X3，在CORE:TP07和S2之后执行。

收尾操作记录：一次暂存请求的自动审批超时；获准重试发现零字节遗留index.lock。经lsof无人持有、无活动Git进程且锁龄超过15分钟核验，保存元数据后仅清理该锁，暂存恢复成功；来源UNKNOWN，不归因为测试或其他任务。见[Git工具事件](./evidence/s2-service-local-20261016/post/git-tool-events.json)。不影响冻结候选的127组结果。最终脱敏秘密扫描exit 0。

格式边界：源码/文档diff-check PASS；全量raw差异检查exit 2，原始生成日志有76条末尾空白行诊断，按收尾检查限定在audit证据目录。保留原始字节及诊断，未声称全量格式PASS。
