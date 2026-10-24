# FEP-4 前端范围收口与里程碑缺口评估

2026-10-24，原计划 I7 / FE:FEP-4；基线5455613f。仅QuantOS/main、本地提交，不使用生产凭据，不推送或发布。

本轮完成的是**已实现前端范围的收口评估**。milestone development_status=PARTIAL；工程Gate `PASS_FEP4_FRONTEND_SCOPE_CLOSURE` 不代表全部FEP-4功能或正式里程碑完成。G4与FEP-4保持 `NOT_READY_GAPS_OPEN`，159项stage_gate不提升，formalAccepted=false、runtimeAdmission=DENIED。G4 review_status继续IN_REVIEW。下一原开发任务FE:UI-603。

## 六项交付核对

|交付|路由/契约|已实现前端范围与保留限制|
|---|---|---|
|UI-401|/markets；C12|授权目录、自选/原请求恢复、独立venue报价、完整来源/时间/质量；没有跨venue合并价格或可执行报价|
|UI-P18|/markets、/markets/:symbol；C12/C16|高保真目录/详情、规范venue/product引用、有限报价流与个人市场域订阅；无单标的阈值规则，缺少24h字段不补造|
|UI-402|/markets/:symbol/chart；C12/C09|OHLCV、缺口、受控指标、订单/成交绑定和断流续读；实际C09同spot来源阳性未提供，不能把Paper/mock改映射|
|UI-P19|同上；C12/C09|图表/分析/元数据、选择/表格、深链和显示偏好；受控K线片段/图像导出缺正式C10契约，未实现|
|UI-403|/performance、/performance/reports/:reportId；C14/C15|金额/币种/估值/账本/口径/provisional、周期报告/固定文档/原字节下载与恢复；当前仅Shadow/USD/simple/UTC/JSON|
|UI-P21|同上；C14/C15|高保真布局、权益/回撤/归因与报表任务；TWR/基准/已实现拆分/其他归因/PDF/CSV等缺源项目不可用|

21项直接依赖逐一映射当前状态/规范摘要及原适用范围。BFF-FE-000–011、UI-P07、CORE-GATE:X3-SERVICE、6个交付节点和G4不因本任务获得新READY或签署；closes_core=[]不关闭任何核心复审。旧失败、incomplete、NOT_RUN与所有原始包逐文件保护为ORIGINAL_SCOPE_ONLY。

## 当前验证与复用

没有发现需要新增修改产品运行代码的缺陷。本轮不改app/src、后端、协议、锁文件、构建配置或共享组件；新增测试/显式模型、收口工具、规程和计划状态。工具以白名单拒绝未声明的产品变化。

- `fep4-fixture.ts` 为明确内存传输模型，仅处理fixture.invalid，调用实际Market/Chart/Performance runtime与路由解析器；完成状态/订单拒绝/队列/幂等由模型设定。11项测试证明当前消费者组合边界，不是BFF、worker、数据库、持久恢复或真实成交证明。
- 新actual read-only consumer在同一原reference实例依次读取C01/C12/C09/C14/C15，验证规范venue交接、C09局部403、C12断流、C14来源核对；只允许loopback GET、无写入。Cookie是测试运输注入，Node HTTP没有验证浏览器CORS。
- BFF二进制复用G4应用源码54684067，执行前核对原binary hash与后端/协议/锁文件未变；不冒充新构建。消费者输入/测试本身绑定本轮新SHA。
- G4应用54684067与工具3507c03a、封包5455613f的234测试/18C12/10C14/12Chromium仅原SHA适用范围；当前保存的原命令/产物/hash与897个历史文件及G4包不变。未重新运行浏览器/Terminal build/Rust原生矩阵，不把原结果改绑当前SHA。
- 当前新测试、G4九项边界直接回归、Terminal typecheck、改动lint、工具/执行策略反例、计划与预期阶段拒绝实际运行。没有全仓/数据库campaign/全部上游递归复验。

重现：冻结新源码后 `node scripts/fep4-function-review.mjs --run docs/audit/evidence/fep4-function-local-20261024/attempt-NN`；只读复核 `node scripts/fep4-function-review.mjs --verify`。新attempt不可覆盖；失败保留命令、退出/信号、日志和NOT_RUN。公开环境白名单不传DATABASE_URL/服务角色密钥。

## 明确保留的缺口

|ID/范围|现状与关闭条件|
|---|---|
|UI402-MARKER-SOURCE-01|NOT_RUN_COMPOSED_SCOPE；真实C09提供同account/mode/venue/product/symbol的spot订单成交，再验证阳性及不匹配拒绝；合成消费者通过不能替代|
|P19-C10-EXPORT-01|NOT_IMPLEMENTED_UNSUPPORTED_CONTRACT_SCOPE；先定义正式K线维度/范围/格式/来源许可/审计契约，再实现受控导出；禁用不是完成|
|C12→C14估值join|NOT_CLAIMED；没有共同价格snapshot就不造市场价→账户收益因果。当前C14来自C15，不新增辅助开发前置|
|G4/核心/provider阶段与页面确认|原状态/原范围保留，G4 IN_REVIEW/NOT_ASSESSED，正式里程碑不能通过本次收口自动放行|
|真实目标与RELEASE|IdP/Cookie/CORS、Supabase/RLS/事务/持久审计、外部市场许可/现金流/成交、跨实例/重启恢复、同SHA远程CI、目标托管、性能/容量/长稳、Firefox/WebKit/跨OS、人工读屏/native200%、完整I7与发布均NOT_RUN|

沿用G4修复的流EOF/UTF8、时间/许可绑定、可选C09局部403重核C01和撤权清屏边界。来源/venue/as_of/quality/口径、断流不拼接与provisional是当前已实现前端范围的核对重点，未决集成/导出义务不删除，也不变为无关UI-603功能开发前置。
