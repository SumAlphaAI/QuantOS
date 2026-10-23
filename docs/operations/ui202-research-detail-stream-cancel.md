# UI-202 Research详情、事件流、取消与恢复

范围：I2 UI-202，C03 `/research/:runId`。复用UI-201/C03网关、ResearchStreamReducer/consumeSse与route-access；原高保真UI-P03仅增加真实详情入口，UI-P04高保真/Artifact/Evidence详情由后续任务交付。

- 静态资源只将research家族的完整UUID路由映射到research.html；查询方式`/research?runId=<UUID>`同样绑定资源。无效、重复或冲突引用在读取前拒绝。生产host的实际rewrite仍NOT_RUN。
- C01双读、固定scope/MFA、research.read和持续授权监控沿用原实现：撤权流、5秒检查、最长8秒未核验窗口；离线、隐藏、失焦、过期、scope变化、401/403均清空详情/事件/游标/取消意图并终止在途请求。恢复只显式重建读取；不重放取消。
- 详情按C03 schema/资源ID解析，输入哈希、快照/任务/关联ID、预算、deadline、创建时间等不可变引用改变时拒绝；终态不能回退。预算与实际成本分列，缺失成本/标题/进度/健康不虚构。Artifact/Evidence只展示引用；快照、审计跳转已存在的真实路由。
- 事件用共享序号/eventId去重、迟到丢弃和gap回补，`afterSequence`总是最后已验证且应用的通知序号。游标确认的是通知元数据，不是详情投影；每条apply后重读C03事实，通知原始payload不直接覆盖状态。拒绝其他streamId/runId、未知版本、无效JSON/错误content-type及超过65536字符的帧。撤权事件先验证并终止，即使重复旧ID/序号也不能被去重吞掉。
- 自动重连最多5次，指数退避250ms至4秒；30秒未确认新事件暂停，需显式恢复。只保留最近200条通知，单页面最多确认2000条，越界拒绝而不推进游标；需要新页面读取。终态succeeded/failed/cancelled关闭领域流，不停止C01授权监控。事件、游标和幂等键均只存内存，不持久化到浏览器。
- 取消前用原C01逻辑重读权限与任务详情，只允许research.write且有CSRF的当前任务。原任务deadline已过不能阻止终止风险操作，不自动将过期视为终态。原生确认dialog支持Escape恢复焦点；在途按钮禁用/运行时互斥，不发并行重复取消。
- 202只记录`cancel_requested`、jobId/statusRef/correlationId/auditRef，不伪造已取消；最终状态只取详情GET。网络/5xx/无效成功回包保留当前任务原幂等键，暂停流，只有用户显式重试才再次POST；离开后先读原任务。409拒绝、429冷却与过期/权限拒绝不自动重发。真实owner负责最终原子性与幂等。

测试仅本机Rust reference C03创建/读取/取消/审计，复用原e3776999二进制与245个未变Rust输入。身份cookie桥、CORS loopback、自签TLS为替代环境；gap/duplicate、跨资源错误、终态success/failure、限流/冲突及丢弃已提交回包均逐项标明合成故障，不冒充真实研究引擎执行。原reference有限事件响应与真实长连接/目标owner的差异保留。

Firefox环境阻塞、WebKit附件拦截接收阻塞、原P05六项图标/UI-201两项表头/UI-P03十二条color-contrast incomplete及历史ledger全部NOT_RUN保留。本轮axe结果独立登记。真实IdP/MFA/Cookie/CORS、数据库/Storage、provider/引擎、生产host、手动读屏/原生200%缩放/跨OS、远程同SHA CI、性能/长稳/发布仍NOT_RUN；人工确认不授予业务用途。

门禁只检查当前功能及直接影响回归，G1辅助项无开发前置。159阶段Gate不提升；G1/FEP-1保持NOT_READY_GAPS_OPEN、formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。完整用户确认稿待本轮工程证据封存后提供。
