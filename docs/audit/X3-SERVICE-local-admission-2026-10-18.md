# CORE-GATE:X3-SERVICE 本地服务功能准入 — 2026-10-18

候选源码 `cd1961951e583a70cd1a5bfbd97f5457d3ba1f57`，基线 `151b3a958e1cb6ed679b0760dcdf1eb4638c687e`。只修改QuantOS，不使用生产凭据，不执行目标数据库或外部发布。17组实际全部PASS，X3-SERVICE_LOCAL=DEVELOPMENT READY，正式确认PENDING。最终状态以 [manifest](./evidence/x3-service-local-20261018/manifest.json) 与 [summary](./evidence/x3-service-local-20261018/summary.json) 的实际结果为准。

## 当前组合与必要修复

新5项聚合测试由真实X03签发/当前X02风险、SERVICE:X06、Paper内核/X04 append-only事实/Fill、X01仓位与X05 ShadowRunner/对账服务组成。固定输入与黄金预期见 [golden](../../services/execution-gateway/tests/fixtures/x3-service-golden.json)：开仓现金1000000、BTC1000/ETH4000，买10 BTC@100、手续费0；期末现金999000、BTC1010/ETH4000、gross501000、PnL0。黄金金额独立手算；Shadow独立计算Decimal财务值，只对单案例的command/order/fill命名空间建立显式一一身份桥，不复制Paper金融值。两边source hash、实际command/审计head/对账report及黄金文件摘要进入原始行为JSON。

真实组合复现X05读取适配器对零USD费用、USDT报价账本的一律拒绝。当前唯一生产逻辑修复是 `from_x04_portfolio`：先解析费用；只有非零费用必须与scope.quote_unit相同，零金额不执行FX。非零异币费用、错误事实anchor、篡改X01仓位继续拒绝。新增Cargo边仅为execution-gateway的测试dev-dependency，不增加SDK、HTTP、数据库或venue运行时。

Paper与Shadow使用不同command_key命名空间，保留RiskGuard同key/不同intent拒绝；对账操作明确使用已有Shadow授权上下文，不放宽为Paper身份。更新报价和恢复后来源必须推进序列/版本。预检中的命名空间、权限和版本冲突均通过纠正测试调用顺序解决，不修改风险/权限/CAS保护。

## 已验证业务与边界

- 真实Paper命令→事实/Fill→X01→X05与独立Shadow订单/成交/仓位/虚拟账本一致；32次当前签名重放无额外内核IO，32次同key对账保持唯一；同gateway租约实例和本地journal恢复后无重复命令/Fill或submit/cancel。
- 从实际组合账本逐类注入全部20种BreakKind，定位实体与独立来源；拒绝无证明关闭，要求ack和更新修复源/CAS；关闭关联异常后日结，再注入推进版本的同类故障重开并撤销日结。原始行为记录实际关联异常关闭数量，不能把“20类”缩成同一种现金差异。
- 当前有效请求与Shadow观察在kill下均拒绝且无提交/虚拟Fill；同user换actor审批拒绝；独立审批、更新健康、kill revision CAS和Owner一次消费后，Paper与Shadow恢复；审批/恢复流程不等于批准生产。
- 完整校验的陈旧X01快照、陈旧财务、陈旧venue观察、撤权及各自期限到期拒绝；保留原风险和审批原子边界。当前服务套件另覆盖权限、MFA断言、未知传输/迟到成交/取消回执、checkpoint锚、独立关闭与incident复发。
- Shadow无kernel/issuer句柄或submit API，X05只读适配器仅回放事实；Python静态边界与编译拒绝、TP12净化签发和本机Paper进程实际执行共同验证当前范围没有venue调用。此处不宣称目标OS隔离或实际凭据/egress审计通过。

## 测试与证据规则

按最新AGENTS.md执行 [17组清单](../../scripts/x3-service-test-scope.mjs)：聚合5、当前服务23、原生Paper进程1（即时/挂单两变体）、直接改动适配器2、dispatch8、实际Agent签发边界1、Shadow禁止submit编译拒绝1，共41项不同Rust行为/契约；LLVM额外执行5项聚合测试。Node门禁45与计划排期44，共89项；Clippy/fmt、计划/handoff及无上游运行时/无submit静态核对。

LLVM先 `clean --profraw-only`，再只运行当前5项聚合测试，最后报告已插桩源，不添加全仓测试。费用解析/guard/拒绝三处修复行均须存在实际已执行region，并以正/负业务断言验证语义；原始数据、命令与日志摘要绑定候选。整文件覆盖率仅参考，不把行上的一次region执行说成全分支覆盖或性能达标。

不执行S2及其他递归依赖Gate、全仓测试、三轮构建、旧10万事件campaign或完整TP12复审；20类异常是本检查点明确要求的当前功能验证。九个依赖仅NOT_REVALIDATED/referenceOnly，不拼接历史READY，也不重授各单任务准入。共享输入变化撤回SERVICE:X06当前独立READY，原bcadfef9/151b3a95证据、正式待确认文稿及其原范围保持不变。

所有预检失败、编译/夹具/覆盖工具错误保留在 [preflight索引](./evidence/x3-service-local-20261018/preflight-index.json)，不作为候选PASS。早期LLVM累积profile及仅报告目标包而缺少依赖文件的结果不采用；正式attempt在新目录、清理profile后执行17组，拒绝跨attempt/历史收据拼接。原始结果、输入和行为在 [function-attempt-01](./evidence/x3-service-local-20261018/function-attempt-01/)。历史52,016个audit/gate文件保持原字节，见 [保留证明](./evidence/x3-service-local-20261018/historical-preservation.json)。

## Gate、未决风险与后续

本Gate仅为DEVELOPMENT本地服务组合准入；完整businessIntegration/releaseAcceptance=NOT_RUN，formalAccepted=false、runtimeAdmission=DENIED、venueAuthority=NOT_GRANTED。ProjectUser确认PENDING；[待确认文稿](./evidence/x3-service-local-20261018/confirmation-draft.md)覆盖Product/Frontend/BFF/QA/Security/Risk/Domain，无真实答复不得登记ACCEPTED。

目标未决：继承S2和各X3任务的实际Supabase会话/MFA/能力/RLS、F05 ledger/outbox/跨组件持久事务与跨进程恢复、可信观察/时钟/凭据/OS隔离和敏感checkpoint/trace治理；CORE:X06/G4/G5/G6页面/BFF完整链路与全仓联调；TP07实际集成后的TP12完整复审；10个实际交易日Shadow、真实日终未解释差异0、负载P95、部署/canary/回滚、安全/长稳/同SHA CI与正式确认。均NOT_RUN。继承X01 f64与固定quote限制，不声称精确会计、FX、真实交易日或目标15分钟检测SLA。当前恢复限同租约实例和本地journal，未知结果无事实时继续隔离。

下一可执行范围建议为 `PREPARATION:P0` 当前功能准入核对，然后按计划进入 `FE:BFF-FE-000`（A1契约/调用链冻结）。既有COMPLETED/ACCEPTED事实不自动重绑当前READY；不跳过P0前置，不直接跳到CORE:X06页面或L4发布。

完整变更文件见 [changed-files](./evidence/x3-service-local-20261018/changed-files.json)，源码和证据分别本地提交；无推送。规程见 [x3-service](../operations/x3-service-local-admission.md)，[ADR](../adr/20261018-x3-service-functional-admission.md)。
