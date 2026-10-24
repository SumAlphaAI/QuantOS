# UI-P11 Orders 与 Execution Detail

路由 `/orders`、`/orders/:orderId`；兼容既有`/orders?approvalId=UUID`。只接受精确UUID引用，不接受账户/mode/Command参数注入。引用不能授予权限。直接在main开发，无生产凭据、推送、部署。

参照design/P11-Orders-and-Execution-Detail-High-Fidelity-v1.png，左侧订单目录含全部/进行中/已成交/异常分类、搜索/标的/24小时筛选和真实游标分页；统计仅已加载部分（每页50、最多1000）。右侧依次是实际Order状态时间线、摘要/剩余数量/成交进度、Fills/执行事件、TradeCommand/关联证据、运营提示与撤单动作。明暗主题及桌面/平板/手机布局，长表具备命名滚动区和键盘焦点。

Order/Fill事实继续由C09 owner查询、有限SSE连续sequence回补和GET比对决定。数量/价格保留Decimal字符串，剩余精确减法；仅0–10000的成交显示基点转Number。未观测到的Command validated/submitted/filled不补画；partial不等于全成。列表只在事实确认后同步当前行。8秒未核查或断流/空洞则显示最后读取事实，禁止新撤单；显式续传从最后确认序号，完整重读从0。终态不回退，Fill只增不删。费用/venueFillID/流动性、签名正文/原幂等键/到期、实时venue健康/延迟/Kill状态无源则显示缺失，不用accepted推断健康。

撤单输入CANCEL ORDER后重读当前权限/能力/Order事实；只发送服务端cancelCommandRef与幂等键。202仅撤单受理；最终cancelled/filled以真实事实为准，成交不删除。未知结果锁定新写/关闭详情/换单，仅显式恢复原body/key，不自动换键或续期。兼容Command提交仍仅发服务端ref；202通用jobId不当Order ID。失权/会话过期/离线/隐藏/失焦/scope变化关闭owner并清除事实、链、对账及恢复意图。

C10“查看完整证据链”仅当当前audit:read能力存在，重读当前Order后按其实际correlation查询。每页100、最多20页/2000节点，校验schema/序号/ID去重/correlation/retention与游标；401清理会话，资源403/404只拒绝此源，不假授权限。换单、事实变化、关闭、读取错误/到期清链。节点仅显示真实kind/对象/时间/hash，不补Verified/签名标签，不猜typed Artifact链接。完整只表示当前授权范围返回链完整。

C15“查看对账来源”是只读GET runs，绑定当前账户/mode，只接受evidenceRefs.kind=order且ref完整等于orderId的来源。每页100、最多1000、循环/重复拒绝；不借用相似ID/相关correlation推断本单对账。展示整批result/breakCount/provisional/到期，整批差异不等于本单差异，暂定/过期不算Clean。无匹配或权限/模式拒绝明确保留未知，不标Pending next run；不写账、不rerun/ack，不提前实现UI506。当前reference C09为Paper，而C15源为Shadow且使用另一个source-record ID，实际精确C09-C15阳性join未提供，保持NOT_RUN；分别验证实际Paper拒绝、实际ShadowC15读取无匹配，以及合成同scope精确匹配。

部分成交/拒绝的浏览器展示使用显式SYNTHETIC探针，不作为实际venue成交证据；真实C09 accepted/cancelled+C10链来自reference BFF原始字节，另执行本机核心OMS的真实partial/reject投影测试。OpenAPI1.16.0及后端未改；没有对账页面、venue指标、提醒订阅或执行报表接口时不提供假动作/无效链接。

当前工程Gate PASS_P11_HIGH_FIDELITY_FUNCTION；计划IMPLEMENTED_PENDING_ACCEPTANCE。正式INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。源码先本地提交，再运行`node scripts/ui-p11-review.mjs --run docs/audit/evidence/ui-p11-local-20261024/attempt-NN`；`--verify`复核。白名单环境、reference合成身份/数据与明确TLS/cookie/CORS回环替身。真实IdP/DB/RLS/持久恢复/真实风险与venue、同SHA远程CI、性能长稳/完整I5/发布NOT_RUN。下一开发任务UI506，I5窗口仍须单独验收。
