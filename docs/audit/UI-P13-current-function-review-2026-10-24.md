# UI-P13 当前页面复核

任务：I8 UI-P13 Operations/Incident高保真页面，依据前端执行计划、原P13设计与C11/C16；仅QuantOS/main，完成代码、测试、文档、证据和计划同步，不使用生产凭据，不推送/发布。

## 交付与数据边界

P13布局落地：七服务视图、聚合健康/组件/当前延迟/DLQ、活动告警搜索/严重性筛选、Incident目录，响应区的时间线/关联对象/审计、诊断摘要、批准Runbook前置条件和当前操作记录。1672/1440双栏，1024重排，390堆叠/局部表格滚动，dark/light。宽屏Runbook移至Incident旁侧以便看到审批目录和检查。

保留UI601运行时/BFF原代码与全部MFA/CAS/审计/恢复/失效/移动禁写；不增加新的写API或任意命令。原生dialog取消、Escape、焦点返回和居中验证；根页面仅对已有首项作只读选择。Incident Audit可用同源、同ID/账户/mode的已验证时间线补回GET未返回的correlation；无audit:read或错链不显示。操作记录只使用真实时间线和本次Runbook回执，回执无时间明确未提供，不生成客户端执行时间/Actor。

P13-C11-SERVICE-01保持OPEN：C11仅service-x06聚合和四组件，不具备七独立服务实例、心跳、P95、趋势、error rate、DB/Vault、工作流限制等字段。七视图全部明确NOT_PROVIDED，不将组件Ready映射为实例Healthy，不用示意图数字冒充真实源。设计适配详见[页面规程](../operations/ui-p13-operations-high-fidelity.md)。事件注释、历史范围与额外关联对象缺契约时不可用。页面实现完成不代表七服务数据或正式验收完成。

## 验证与证据

新增presentation单元及现有UI601策略/实际Rust reference消费者直接回归；新Chromium6项、当前UI601浏览器8项；8组dark/light×1672/1440/1024/390几何/axe和主截图、移动Runbook截图与确认弹窗。类型/lint/构建/计划、静态路由/阶段政策。产品运行时及BFF代码未改，不重复未受影响native/上游/数据库campaign；旧UI601原生正向只作ORIGINAL_SCOPE_ONLY。

preflight为未冻结工作树：UTF8拼接工具首次SyntaxError未改workspace，改用模板后完成；该终端错误无独立原日志，不补造。首轮46项单元和6项浏览器通过，人工看图后调整宽屏Runbook位置，补齐Incident/Runbook几何关系断言；后续冻结矩阵才认当前PASS。已查看预览dark1672及light390下部，不用截图文件名代替实际主题断言。原日志/截图保留。

精确命令、数量、源SHA、原日志与构建/截图散列以[证据](./evidence/ui-p13-local-20261024/README.md)receipt/result为准。真实本机reference C01/F06/C11/C16、受控X06/F09；身份cookie桥接/TLS CORS代理是替代。短期限Healthy快照单独SYNTHETIC，仅验证展示过期且七视图仍未知，不作提供方Healthy证据。主要布局截图用实际创建、确认的Incident与两条真实时间线。

## Gate与未决事项

工程Gate目标PASS_UI_P13_OPERATIONS_HIGH_FIDELITY，开发IMPLEMENTED_PENDING_ACCEPTANCE，仅表契约支持范围的高保真适配/交互。sevenServiceHealth=NOT_PROVIDED_C11_CONTRACT、P13-C11-SERVICE-01_OPEN；正式stage_gate保持NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED，不自行批准ACCEPTED。

保留UI601两项HTTP正向NOT_RUN（InspectEvidence无reference订单源、修复后resolve无HTTP修复端点），native/内存不替代HTTP。G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL与原marker/蜡烛导出/估值join缺口不变，UI601/UI603/P23/G4/FEP4历史证据逐字节保留ORIGINAL_SCOPE_ONLY。真实IdP/cookie/CORS、目标DB/RLS/事务、外部源、远程同SHA CI、Firefox/WebKit、人工读屏/原生200%缩放、完整I8、性能/长稳及RELEASE仍NOT_RUN；axe incomplete原样保留。

INTEGRATION预期拒绝；下一原开发任务FE:UI-602 Admin治理，不将P13来源缺口作为其开发前置。回退为源码提交经审阅git revert、重建terminal，无DB迁移、生产写入或业务事实清理，原证据保留。
