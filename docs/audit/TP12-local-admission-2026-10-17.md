# TP12 X3 当前边界功能验收

2026-10-17。仅 QuantOS。本轮功能 DEVELOPMENT READY，正式 ProjectUser 确认 PENDING；完整业务联调、TP07 集成后的 TP12 完整复审及发布均 NOT_RUN。没有生产凭据使用、目标数据库执行、上游运行时安装/执行、推送或外部发布。

## 结果与变更

固定源码 `6af44a970b2c25d75b61bde956143f927e231981`，基线 `941702bd8abbd83947a559d5889284c642905093`。25个实现/测试/规程文件，完整文件和摘要见 [changed-files.json](./evidence/tp12-local-20261017/changed-files.json)。独立 [manifest](./evidence/tp12-local-20261017/manifest.json) 摘要 `sha256:157100722802afa81fb58387cf8a7c8e8dd7002f0c9105f1e52b40effa53249f`，绑定550项实际输入与规范任务范围；其中413项生产文件/manifest/lock只做静态依赖排除扫描，没有调度全仓测试。

- [dispatch.rs](../../crates/quantos-execution/src/dispatch.rs)：修复真实SignedExecutionGateway路径中idempotency_key包含tenant/workspace和原始调用键的问题，改为版本化域标识+规范JSON元组SHA256；account/venue按契约保留，风险/审批/唯一消费不变。
- [当前签发边界测试](../../crates/quantos-execution/tests/tp12_boundary.rs)：观察真实签发到kernel的12字段及值，拒绝Agent trace/伪造签名，验证重放不增加调用、两独立键不同、身份/原始键/签名不越界。
- [机器边界评估](../../third_party/nautilus-agents/x3-boundary-review.json)：7条禁止耦合规则、6面接口差异、8项威胁假设，均关联当前控制/行为测试。原12个上游文件及Git tree/blob绑定不变，无wire兼容或运行时采用。
- [评估工具](../../scripts/tp12-boundary-review.py)和新Python/Node负向测试：固定参考/映射、重命名依赖/常量动态加载/源码导入、路径逃逸、证据/阶段/权限提升拒绝；新本机Agent UDS进程测试覆盖建议、重放与权限/模式/工具/字段拒绝。
- TP12_LOCAL门禁/记录器/20组清单、Makefile、双计划/阶段契约、Beta移交、[ADR](../adr/20261017-tp12-x3-boundary-review.md)、[威胁模型](../operations/tp12_nautilus_agents_threat_model.md)、[接口差异](../../third_party/nautilus-agents/interface-diff.md)和[操作规程](../operations/tp12-local-admission.md)同步。

## 测试与原始证据

本轮 [function-attempt-01](./evidence/tp12-local-20261017/function-attempt-01/execution-results.json) 在固定源码上20组全部PASS。Rust16、Python88（69 Agent probes + 19 reference/review tests）、Node83（39 Gate + 44计划负向）全部通过；新Python检查、Rust格式和Clippy通过。精确命令、原因、时间、退出码、信号、超时和日志SHA在执行结果及manifest；各原始日志均保留。

| 检查 | 结果与范围 |
| --- | --- |
| reference/current review | 固定12文件，7规则/6接口/8威胁、生产导入/依赖排除；runtime DENIED |
| Python评估/反例 | 19测试，包括16类阶段/协议/证据篡改子例和12类依赖/加载子例 |
| 实际Agent边界 | 69测试：字段别名、工具、fixture建议；真实本机UDS子进程非可执行/重放/撤权/模式/注入拒绝及恢复 |
| X03 issuer/approval | 2项当前签发拒绝/审批CAS/职责分离/取消与过期 |
| tp07_dispatch | 8项当前风险/kill/审批绑定、1000并发唯一消费、uncertain claim、隔离消费者及失败回滚 |
| 新TP12 signed boundary | 1项真实签发/下游12字段值净化；两命令两调用，首命令重放无额外调用 |
| R04/X05 | 2项实际Artifact provenance/坏引用拒绝和重哈希journal不能伪造关闭 |
| X04 cancel/control/Paper | 3项取消/权限拒绝及真实自有stdio Paper进程提交取消/终态审计 |
| Gate/计划 | 83 Node测试及双计划/双移交检查，拒绝历史READY拼接/零行为日志/错误SHA/输入漂移/目标提升并验证发布回滚 |
| 静态检查 | 新Python Ruff、直接改变的Rust文件格式/新测试Clippy；编译在对应Rust测试执行 |

[早期尝试说明](./evidence/tp12-local-20261017/preflight/attempt-notes.json)及原始日志保留：沙箱UDS拒绝2次；获准本机UDS后通过。旧lib净化单测编译/启动300秒超时，未记PASS；转为更贴近当前真实签发路径的新测试并将Rust编译界限设900秒，这不是性能验收。新测试首次实测失败暴露幂等键值越界，修复后全部当前检查通过。预检发生在开发中，不是冻结候选准入。

## Gate 与风险

| 层次 | 状态 |
| --- | --- |
| CORE:TP12 / TP12_LOCAL | functionImplementation=PASS，DEVELOPMENT READY |
| F07 / TP07 / S2依赖 | NOT_REVALIDATED/referenceOnly，未拼接历史READY |
| X05独立READY | 因上游dispatch/共享门禁输入变化撤回；X05本模块未修改，旧源码/证据不变 |
| 业务联调/TP07后完整复审 | NOT_RUN |
| CORE-GATE:X3-SERVICE / BETA | NOT_ASSESSED；本轮不授予聚合或发布 |
| 上游runtime / 生产 / 外部发布 | DENIED / false / false |
| 正式用户确认 | PENDING；[完整确认文稿](./evidence/tp12-local-20261017/confirmation-draft.md)待项目用户一人实际确认 |

七类目标移交保持NOT_RUN，并继承EVAL-TP12九组目标及原移交：TP07完整业务联调后的复审；真实Agent/kernel transport、OS/egress/凭据接收方；Supabase/RLS/持久原子签发/审批/幂等/CAS与跨实例崩溃恢复；受限trace留存/逐字段治理；协议演进；法律/完整最新供应链/CVE/可达性/签名；目标安全/性能/长稳/同SHA hosted CI及正式确认。未声称仓库安全审计、当前CVE清洁、真实Nautilus执行或实际venue隔离。

SHA256键保持当前进程内scoped幂等；未来持久化/键版本迁移须独立处理旧键兼容和崩溃恢复。摘要不等于加密或OS隔离；通用ExecutionGateway须由可信宿主限制可达性，account/venue仍有意在kernel保留。Agent fixture Artifact不是生产审计；retention/field metadata仍为未实施候选。[固定源码人工核对](./evidence/tp12-local-20261017/manual-source-inspection.json)另澄清：Full拒绝原始Restricted，Redacted依赖调用方redactor并检查输出retention，不是原始Restricted一律拒绝；未来采用必须单独审查redactor信任/重分类和实际存储。

51,827份原有audit/gate文件按Git基线检查保持原字节/原范围；[X05撤回记录](./evidence/tp12-local-20261017/x05-admission-withdrawal.json)不重写旧收据。`--runtime`、target-check与release-check本轮均应exit2拒绝。源码提交 `6af44a970b2c25d75b61bde956143f927e231981`；审计证据为后续独立本地提交，可由Git日志和变更索引核对，没有推送。

下一可执行任务：SERVICE:X06 执行/审计/运维服务功能，按当前功能与直接影响范围实施；TP07完整业务联调之后再执行TP12后置完整复审。
