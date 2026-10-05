# FEP-0 整改与复验记录（2026-10-05）

状态：工程实现及针对性修复已完成，待修复后完整功能闭包复验；尚未登记 READY。

初审原件：[FEP-0 全面复审](./FEP-0-comprehensive-review-2026-10-05.md)，18/20、B-01/B-02；原审计与失败记录保持不变。

本轮新增六项 F0 功能回执策略、F0 聚合、FEP-0 八依赖内容校验、负向及 CI 接线。变更验收源码使既有 broad input inventory 失效，相关 stage_gate 已回到 NOT_ASSESSED，待新闭包执行；原日志/manifest/正式字段保留历史。G0 原用户确认保留原件，新输入范围待更新文稿确认。

工程实施与环境边界见[验收规程](../gate-records/fep0-development-acceptance.md)。F07 保持诊断与临时管理员 Storage 身份的真实记账，发布要求不进入本轮完成分母；数据库只连接现有配置的 Supabase。

源码 `f37360b` 的首轮实际执行为 86 项、81 PASS / 5 FAIL，未发布任何 READY；[执行清单](./evidence/provider-a1-remediation-20261004/fep0-20261005/execution-results.json)和所有原失败产物保留。失败涉及 F09/macOS 证书寿命兼容、npm/braces 新公告、F07 trace 配置与随后复验暴露的 CSRF Cookie 缺失、F08 stable/nightly 计数边界及 macOS UDS 路径。已逐项修复：TLS 继续校验 CA/主机名，依赖补丁保留上游 finding，runner 按现行安全契约执行；未降低 nightly 分支覆盖率或放宽数据库环境。

针对性复验已通过 178 项 FEP-0/回执/G0 回归、6 项补丁测试、真实 Supabase F07 服务、九个 wheel/UDS 场景和四生态 SCA。此处为预检结果，完整闭包须在新冻结源码重新执行。当前 G0 功能输入已变化，原用户确认原件保留，新文稿尚待实际用户确认；不能由 Codex 自行批准。

`3a592a4` 的第二轮在发现明确失败后中止，没有执行完完整闭包，也未发布 READY；[部分执行记录](./evidence/provider-a1-remediation-20261004/fep0-final-20261005/assessment-summary.json)独立保留。已进一步修正锁文件检查及 SCA 负向 fixture 的补丁复制、F09 Runtime trace 测试的 CA/verify-full 配置。针对性预检为 F01 19/19、F02 17/17、真实 Supabase Runtime write trace 1/1 和 CA 配置拒绝测试 2/2 PASS；受沙箱缓存权限/未配置 Gitleaks 的预检失败原日志也保留。完整阶段结论仍须新的冻结源码实际执行。
