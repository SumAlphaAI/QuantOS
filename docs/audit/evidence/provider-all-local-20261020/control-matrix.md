# 功能控制与证据

| 控制 | 当前证据 | 结论及范围 |
|---|---|---|
| 完整API范围 | contract / g0-minimum / http | 本机PASS；12任务、134项、17契约、113schemas、710字段；无planned；六生成物、14最小schema、22页/19处置 |
| 混合读取与权限 | native provider_all_tests / consumers ALL | 本机PASS；同provider实际各族读取；Owner成员管理与Trader审计不混用；读取不产生执行authority |
| 模式边界 | native / HTTP / consumers | 本机PASS；Paper拒绝Shadow专用对账/账本/Performance；Shadow成功路径独立当前探针，Shadow不seed Paper执行/策略host |
| 匿名与公开API | contract / native / HTTP | 本机PASS；各域失效身份401；submitAccessRequest公开202/422/429契约例外，C17策略有效身份可读，不伪造403 |
| 当前撤权与隔离 | native ALL与A4/A5/A6 / consumers | 本机PASS；实际Owner成员撤销后原current会话各域401；共享poison503；过期401；历史恢复不绕过当前身份 |
| 幂等、原子与审计 | 全部当前BFF lib / auth-audit / API HTTP | 本机PASS；重试/changed-intent/CAS/revision/范围权限，审计可定位；进程内能力，不声称目标数据库事务通过 |
| 恢复和独立期限 | 当前native / HTTP / clients SSE | 本机PASS；流token/分页cursor/下载ticket/版本不能跨资源；deadline不因observer/session续期被隐式延长；有限帧和本机leases |
| 风险与敏感字段 | execution/command/platform/operations native+HTTP | 本机PASS；读risk预检不记录执行decision；202只accepted；下载历史无签名URL/敏感字段，浏览器不扩大能力 |
| G0当前工程冻结 | g0-minimum/g0-records/pre01/generated/pre04/web-poc | 本机PASS；当前源scopeDigest与6生成摘要；Web/模拟OIDC/route/axe/视觉/SSE基础，单次静态构建预算，非目标性能通过 |
| 门禁不可提升 | 70gate receiver+plan/CI负例+实际入口 | 本机PASS；工程PASS与DEVELOPMENT BLOCKED分开；CI admitted=false，严格入口exit2；pending G0不能绕过为新页READY |
| 原始确认与历史 | 18original source/log/artifact proofs+A6confirm+history | 本机PASS；原范围不变，历史技术回执不改绑为当前独立READY；A6原确认仅原源码和原稿 |
| 源与原子发布 | recorder before/after source checks / gate / rollback unit | 本机PASS；新候选独立attempt，命令/exit/signal/error/timeout/时序与日志/嵌套hash校验；入口失败回滚manifest/计划 |

G0/ALL用户确认PENDING，G0阶段NOT_GRANTED、ALL BLOCKED、page/runtime DENIED。全链INTEGRATION与RELEASE/目标义务NOT_RUN。

G0附加未决项：原19条台账有8项API工程条目仍PENDING（Backtest SSE、C02、C12、C14、C13、C15、C11、C16）。本轮真实API证据已PASS，但原台账未自动变为IMPLEMENTED_ENGINEERING/CLOSED；见[逐项复核映射](./g0-disposition-recheck.json)。映射仅供G0独立当前复核，不授予G0或页面准入；后续须同步当前处置和适用残留、绑定范围及实际用户确认后再执行门禁，不能仅确认ALL稿即READY。

版本补强：第三轮c3203f95的20组和5入口已通过并保留；索引复核发现244个G0附件文件未在ALL主输入中，实际原Git字节均与c3203f95一致（[复核记录](./preflight/g0-source-binding-recheck.json)）。现已将附件功能输入并入统一源清单，加入拒绝测试，在本稿最终候选重新独立完成当前20组；第三轮不改绑为新候选。
