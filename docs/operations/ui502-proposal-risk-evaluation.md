# UI-502 Proposal 与风险评估

当前功能路由 `/proposals`、`/proposals/:proposalId`；严格 UUID 静态映射与客户端解析，无泛化SPA回退。只使用公开生成 C01/C07，C13 GET预检作为C07所需服务端contextHash的只读来源；不构造hash、风险结论、签名或命令。P09高保真及C10证据内容增强单列为下一任务。

## 不可执行与事实

所有可读/加载/空/错误/拒绝/过期/离线页面永久显示“这是交易建议，不是订单 · executable=false”；固定底栏保证滚动详情时仍可见。生成schema和应用严格校验 executable=false，嵌套Signal、账户/资源/时间、反方观点、证据UUID、精确Decimal字符串和置信度。未知扩展命令字段拒绝，不混用legacy测试域模型；不提供下单、批准或命令提交控件。

列表按服务端status/symbol查询与不透明cursor分页，单页50、总1000的有界内存；校验返回范围、去重、游标循环，不静默截断。不持久化领域数据/上下文/幂等键。列表是查询快照，详情独立读取；读取失败保留仍获准的旧快照并标未核验，资源404清除对应详情，401/403读拒绝或C01撤权清除敏感状态。

详情显示Proposal、Signal、论证/反方观点、源精度/名义值（不推断币种）、证据引用和有效期。通用evidenceRefs无类型，不猜测Artifact链接；有真实correlationId才链接已有Audit目的地，不把generic jobId当作Approval或RiskDecision引用。

C07 SSE同资源密集journal校验streamId/sequence/账户/proposal/correlation/同版本不可变内容/状态回退；有限参考流以2秒轮询恢复，丢帧/换租约/错误/撤权禁写并需显式读取，不自动重发评估。目标长期SSE仍NOT_RUN。

## 预检、评估、恢复

1. C01 session/context绑定actor/tenant/workspace/account/mode/environment/MFA/capabilities与最短会话期限。只开放Paper/Shadow，要求服务端execution.operate；该capability不代表当前Proposal所有权，BFF逐次判定发起人，客户端不按actor推测授权。
2. “刷新风险上下文”只读C07详情/状态流及C13预检。预检必须匹配当前Proposal/账户/模式/版本与服务端sha256 hash、asOf/有效期；来源asOf达到60秒、预检/Signal/Proposal过期、当前deny、未核验均禁评估。预检核验/状态流各8秒有效，C01由UI101持续重验。
3. “请求风险评估”只能对active且无该版本既有回执的建议执行。请求前重新读取身份/Proposal/流/预检；版本、不可变内容、hash、verdict或命中变化时返回新内容供显式审阅，本次不POST。仅将path Proposal ID、原objectVersion的If-Match、服务器contextHash、CSRF、独立幂等键/请求ID送出；不发送actor/source/risk/signature/order数据。
4. 202只能成为受理回执。校验status=accepted、jobId/correlationId及与Proposal的关联，审计引用有则展示；另行读C07状态，不能以202推断风险通过、批准或Order。相同Proposal版本回执阻断重复新评估（内存最多100条），状态不是active也禁用。
5. 网络/5xx/非法回执/不确定状态锁定原proposal/version/hash/key，停止写入并清除预检。显式读取/连接恢复不POST；在原建议、当前新鲜且未拒绝的上下文中，显式重试原body/version/key，不换意图。换到其他建议仍保留全局未知锁，必须返回原建议恢复。恢复429/409等继续保留未知意图，429冷却有界。**过期后连原POST恢复也禁止**，仅查询状态/审计，不用旧建议再评估。
6. 首次明确401/403/404/409/422/429拒绝清除尚未确认的pending并要求新审阅，不自动套用currentVersion。服务端机器码按安全白名单映射，保留校验过的correlationId，不显示原始SQL/私有错误message。操作403（非发起人）不授予写权限，也不自动收回仍有效的建议读权限；C01/读权限拒绝独立清除。

关闭/离线/隐藏/焦点变化/撤权时清除领域事实、receipt和未知intent，只保留最后成功读取时间；导航到其他同账户建议不丢弃未知intent，离开文档前提示结果未知。真实跨进程/持久恢复仍需发布验收。

## 功能验证与交接

`node scripts/ui502-review.mjs --run <新 attempt>` 对冻结源码/全部功能输入运行当前单元、实际参考消费者、C07宿主直接回归、路由监视/导航/静态host、typecheck/ESLint、静态构建、Chromium成功/拒绝/恢复/基本明暗桌面移动axe；`--verify`复核原始命令、输入、二进制/产物/网络/截图哈希。参考身份、固定测试MFA（仅外部Kill负面控制）、TLS/CORS替代有界标注，不使用生产凭据、不推送/部署。

工程有界结果不提升正式INTEGRATION/RELEASE：IMPLEMENTED_PENDING_ACCEPTANCE、INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。真实IdP/cookie/CORS、Supabase/RLS/事务、R04/X02持久链、真实行情/风险源、长期SSE与持久恢复、多浏览器/跨OS、人工读屏/native200%、远程同SHA CI、性能容量长稳、完整I4/RELEASE均NOT_RUN。下一原任务 **FE:UI-P09**。
