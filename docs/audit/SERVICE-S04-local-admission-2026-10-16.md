# SERVICE:S04 本地开发准入验收报告

执行日期：2026-10-16。仅修改QuantOS；分支 `codex/service-s04-strategy-api`。冻结源码 `1ce8e8998a769e1bf0a04670e1422739c4992788`，基线 `7b75e07739d86c3798297771c54563b4a7b9544a`。证据归档提交与冻结候选分别记录，未推送、未执行外部发布。

本轮 **SERVICE-S04_LOCAL / DEVELOPMENT READY**，工程复核PASS。直接依赖S01、S02、S03、F06、R1-SERVICE均在新候选重新执行；展开36节点/118组，115组依赖先于3组自身检查。不是拼接历史READY。S03旧独立准入因共享功能输入变化撤回，d10740c1及原始历史证据保留。本轮不授予上游独立READY。全图1 READY / 158 NOT_ASSESSED / 0 BLOCKED；S2整体、正式验收与Beta尚未放行。

## 变更与范围

- 新增owner-service `/strategy/v1`真实HTTP路由及策略应用服务，覆盖目录、Lab预览、S01版本/CAS与静态检查、S02回测、S03 Release/审批/配置消费、作用域审计。
- 可信宿主注入SessionResolver、clock和不可变输入目录；目标适配器复用F06身份/成员权限验证。客户端只能引用服务端输入及回测ID，不能构造源码/镜像/报告/验证或审批凭据。
- tenant/workspace隔离、显式capability、服务端can_approve/deployable_targets、发布者不能自审批、单次决定、hash/TTL/CAS与消费时再次校验。拒绝决定需新版本/新Release。
- 同一服务锁内写入业务结果与审计，按作用域sequence/hash链记录成功、拒绝、冲突；不保存bearer或原始请求。body/参数/分页/容量和HTTP并发/期限有界。
- 独立准入门禁核对36节点、同候选依赖、真实HTTP输出中的Release/报告/审计绑定、两个原生adapter报告一致及所有越界声明；发布manifest和两份计划失败时恢复全部原字节。
- 同步两份计划、机器依赖契约、共享回执配置、发布移交、Makefile、README、ADR及操作说明。公共BFF `/v1` 映射归BFF-FE-004；P06/P07及20个UI fixture归CORE:S04/G3，本轮没有页面验收声明。

完整变更文件及SHA-256见[changed-files.json](./evidence/service-s04-local-20261016/changed-files.json)，索引自身由最终Git提交绑定，避免自引用。关键实现为[service.rs](../../crates/quantos-strategy/src/service.rs)、[http.rs](../../crates/quantos-strategy/src/http.rs)与[HTTP测试](../../crates/quantos-strategy/tests/service_s04.rs)。

## 测试与证据

| 检查 | 实际结果 | 范围 |
|---|---|---|
| 新候选完整依赖与自身 | 118/118 PASS；36节点 | 35依赖节点/115组，再3组自身 |
| 三次独立构建 | 3/3 PASS | 同一冻结源码、离线依赖、跨语言构建 |
| make lint / make test | PASS | Rust 414 passed / 11 ignored；Python1845 passed；Web233 passed / 3 skipped |
| SERVICE:S04真实TCP HTTP | 6/6 PASS，0 ignored | 自有Python UDS产生102 Artifact；真实本机TCP请求；两种实际原生adapter重放 |
| 准入门禁 | 109/109 PASS | 混候选、缺依赖、证据篡改/跳过、越界声明与发布回滚 |
| 专项拒绝/竞争 | PASS | 100次未验证/未审批拒绝；100次来源伪造；20路审批1成功19冲突；过期/拒绝/越权与恢复 |
| 审计绑定 | PASS | 成功链16事件逐条核对sequence/previous_hash/content_hash/关联ID、审批者及资源hash；负向事件在各专项测试中核对 |
| canonical证据恢复 | PASS | 637文件原字节、4目录原有缺失状态恢复 |
| 计划/交接/本地准入/发布拒绝 | PASS | 真实命令及预期退出码见post/checks.json |
| 数据库/目标/外部发布 | NOT_RUN | databaseExecution=false、externalPublished=false |

时钟在服务事务锁内读取，避免排队后的过期检查使用旧时间；另有1项确定性回归PASS。首次候选9ba06be2在公共make test期间主动中断以修正此点，4组通过、1组SIGTERM，原始日志和canonical恢复记录保留在attempt-01；本次新候选从零重跑，没有复用通过组。Rust ignored与Web skipped均未记作通过；部分PostgreSQL测试在缺配置时返回NOT_RUN，harness成功计数不能作为数据库实际验收。预检阶段曾有scope prose/JSON同步缺失、Clippy参数超限和格式问题，均修复并重跑；原始失败和修复后日志见[preflight](./evidence/service-s04-local-20261016/preflight/index.json)，属于未冻结工作区，不能替代本轮完整证据。原始生成日志的尾部空行保持原字节，完整raw差异有76处生成日志EOF空行诊断（exit 2），见post/diff-status.json；源码/文档单独检查PASS，不宣称全部raw无格式诊断。

- [本任务manifest](./evidence/service-s04-local-20261016/manifest.json)：冻结候选与完整闭包。
- [执行结果](./evidence/provider-a1-remediation-20261004/service-s04-local-20261016/attempt-02/execution-results.json)、[依赖先后顺序](./evidence/provider-a1-remediation-20261004/service-s04-local-20261016/attempt-02/dependency-revalidation.json)。
- [实际HTTP输出](./evidence/service-s04-local-20261016/http-evidence.json)：完整Release/报告、审批、消费者hash及审计链；release hash `sha256:08268a2090f09c1ef77478ca4e20e70287e331aa695c378eecfcaf35fa61e85e`，报告 `sha256:42a9db1480ad3f911d5dc6e7c630e88f124c65ad80874e669d33dcc8385f3310`。
- [摘要](./evidence/service-s04-local-20261016/summary.json)、[canonical恢复](./evidence/provider-a1-remediation-20261004/service-s04-local-20261016/attempt-02/canonical-preservation.json)、[收尾检查](./evidence/service-s04-local-20261016/post/checks.json)。

收尾第一次校验发现检查点进度说明重复使用任务专属“当前工程复核”前缀，已仅修正文档状态标签并重跑6项收尾校验PASS；失败原始日志保留在[post/attempt-01.json](./evidence/service-s04-local-20261016/post/attempt-01.json)。规范范围、代码和冻结功能输入未变。

## 未决风险与门禁

DEVELOPMENT READY仅覆盖进程内owner-service功能。重启会丢失业务和审计状态，审计hash链也不等于外部不可变存储。可信宿主必须正确提供身份、成员状态、clock与来源目录；本轮真实HTTP只验证本地私有会话fixture，SupabaseSessions目标路径未连接。

继承22组共享目标义务及4类本任务发布义务：实际Supabase身份撤权、持久草稿/回测/Release/审计事务、RLS与跨进程审批CAS/恢复；真实部署Paper/Shadow消费、OS隔离/凭据与来源保证；代表性安全/负载/性能/长稳；同SHA hosted CI。全部NOT_RUN，归测试及RELEASE-GATE:BETA首次发布前实际验收。未创建本地PostgreSQL/Supabase，不使用生产凭据。公共BFF、页面、UI fixture和完整浏览器矩阵保留在对应计划节点。

`formalAccepted=false`；[完整六维项目用户确认文稿](./evidence/service-s04-local-20261016/confirmation-draft.md)已拟定但PENDING，没有原始用户确认记录。按[统一规程](../gate-records/user-acceptance-confirmation-workflow.md)，Codex不能自行批准；人工确认也不替代未执行的目标证据。本地开发Gate不因此阻塞，但正式ACCEPTED、S2整体和发布门禁均未放行。

## 下一可执行任务

**EVALUATION:TP07**：按计划先对F03/F06/F08新候选依赖复验，固定TP07 commit/许可证/SBOM/CVE，完成capability inventory和执行边界/替换预案ADR；评估本身不引入运行时依赖。随后EVALUATION:TP12，再汇总CORE-GATE:S2-SERVICE。CORE:S04页面仍依赖U01及FE:FEP-3，当前不宣称可直接验收。
