# UI-203 Artifact/Evidence详情与交叉跳转

范围：I2 UI-203，C04 Artifact及归档内容、C03父任务归属与inputHash、C10审计关联。复用原Research与Audit网关、UI-201身份加载、持续route-access；不修改后端/契约、原gateway/runtime/policy及共享SSE。

- `/artifacts/:artifactId`及`/artifacts?artifactId=UUID`，可携带runId/evidenceId；`/artifacts?runId=UUID&evidenceId=UUID`从父Research的最多20个Artifact引用定位唯一Evidence所属产物。完整UUID规范化小写，重复/冲突/未知查询键与无范围Evidence拒绝。静态仅artifacts家族UUID映射，无通用fallback；生产host实际rewrite NOT_RUN。
- Research的artifactRefs/evidenceRefs与Audit明确kind/objectRef生成安全交叉跳转，目标页面重新授权；不跟随服务端任意route/URL，不把C10 eventId当研究evidenceId。lineageRefs仅显示引用，未声明类型不捏造链接。
- 显示hypothesis/summary、contentHash/environmentHash（服务端）、Engine/prompt/code版本、dataSnapshotId、createdAt和本次读取correlationId/auditRef。inputHash取已经过成员、snapshot与hash一致性核对的C03父任务，或经过格式校验的C04可选inputHash；缺失明确显示未提供，不用contentHash替代。直达Artifact时不反向扫描所有Research。
- C04 live已提供的evidence扩展按evidenceId/artifactId/summary严格校验（最多200项，拒绝跨产物、重复、无效引用）；未返回时明确缺失。Evidence选中态显示摘要/所属Artifact并可回到产物/父Research。Reference预置Artifact为明确synthetic内容，默认不含domain Evidence；关系用例只注入标明合成的元数据/成员引用，不假装worker完成。
- 内容预览仅显式GET，先重读元数据、绑定artifactId/contentHash，JSON媒体类型与262144字符上限；用React文本显示，HTML/脚本/URL不执行，不创建下载或外部导航。服务端canonical archive hash不等于浏览器重新计算内容或独立签名验签。附件本次audit/correlation独立显示，不混淆原元数据读取事实。
- Artifact固定contentHash、snapshot、environmentHash、版本及正文/证据摘要变化拒绝；失败清除页面事实。C01双读/固定scope/MFA、research.read及持续授权沿用原5秒检查/8秒未核验窗口；撤权、离线、隐藏/失焦、scope/过期清空元数据/预览/关联链并中断在途请求。所有状态仅内存；恢复只重新读元数据，不重放预览/写入。
- C10查询另需audit:read，仅允许当前产物/父Research实际返回的correlationId。每页100、最多20页/2000节点，拒绝重复ID、序号逆行、游标循环、complete与nextCursor矛盾；retention到期拒绝并绑定页面资源失效deadline。complete仅当前授权范围完整，不代表全局因果、签名或发布通过。429等待期间再次操作不延长已生效冷却，不自动重试。

本机只启动已有e3776999 Rust reference二进制，245Rust输入未变，不构建Rust/不复验上游全链。浏览器业务交互均GET（服务端可追加读取审计）；个别关系测试仅Node控制创建reference种子。身份cookie桥/CORS loopback/自签TLS替代、合成关系/分页/保留期/故障逐条标记。无生产凭据、真实数据库/Storage/provider/engine动作、推送或部署。

保留Firefox/WebKit阻塞、原6图标+2表头及P03十二条incomplete与全部历史NOT_RUN。本轮axe独立登记；真实身份/CORS/目标DB/Storage、实际engine产物、生产host、手工读屏/原生200%缩放/跨OS、同SHA远程CI、性能/长稳/发布仍NOT_RUN。当前实现不冒充UI-P04高保真、真实引擎完成或formal acceptance。159阶段Gate、G1/FEP-1状态不提升；人工确认待原稿；下一原任务UI-P04开发无G1辅助项前置。
