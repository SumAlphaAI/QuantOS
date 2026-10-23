# UI-P09 Proposal列表与详情高保真

依据design/P09-TradeProposal-List-and-Detail-High-Fidelity-v1.png；路由沿用/proposals及严格UUID/proposals/:proposalId。桌面主从分栏、窄屏纵向显示，选择后焦点/滚动到详情，历史返回/关闭详情不产生业务请求；所有加载/空/错误/拒绝/离线与滚动状态保持executable=false，固定底栏持续可见。

列表沿用C07服务端status/symbol及不透明cursor查询；分类、当前载入ID/symbol/release搜索、发布筛选与到期排序是本地呈现，明确显示“当前载入”计数，不能当全局总数。Expiring指当前active建议两分钟内失效，不推断风险严重性；Evaluated只是已返回的非active状态集合，不代表评估允许。完整Decimal不转float；列表保留独立查询快照，不以详情当前状态改写已查询列表。

详情按设计呈现建议摘要、Signal、论证/全部反方观点、组合风险上下文、不可变来源引用、证据引用及失效行为。限价/Proposal创建时间、完整NAV/敞口/阈值、DataSnapshot/inputHash、证据类型/标题/正文/时间/版本/发布许可未由C07返回时明确未提供。Signal generatedAt不当作Proposal createdAt，generic evidenceRefs不冒充Artifact或审计eventId，不猜测内容跳转。通知订阅来源不支持，按钮禁用；复制ID只在用户操作后使用剪贴板且失败有提示。

风险评估沿用UI502：C01持续授权，C07详情与密集状态流、辅助C13只读预检，8秒核验窗口/60秒源时效，临提交重读并对比Proposal版本/不可变内容/上下文与命中；exact If-Match/contextHash/幂等键，202仅受理，不构造RiskDecision/Approval/Order。未知结果保留原body/version/hash/key，读取不重发，显式原意图重试也受当前期限与拒绝约束；最多100已确认回执，容量满拒绝新写且不淘汰锁。权限/离线/隐藏/失焦/关闭清除敏感状态，跨进程持久恢复仍NOT_RUN。

C10新增显式“查看证据链”：另需audit:read及当前Proposal真实correlationId；请求前重读C01与当前Proposal并比较资源/版本/不可变内容/关联引用，只GET当前链。100节点/页、最多20页/2000节点，校验schema/关联范围/唯一ID/安全整数递增sequence（允许全局序号间隔）/cursor绑定与循环/complete一致性/时间与retention。过期链不再显示；错误清除链，C10资源403/404不提升/篡改建议，401触发整体撤权。429有界冷却、重复本地操作不延长；关闭及迟到响应不能复活链。不跟随EvidenceNode任意route，不补造actor/创建/风险通过事件，complete仅当前授权范围完整，不代表全局因果或独立验签。

`node scripts/ui-p09-review.mjs --run <新attempt>`验证冻结源码、设计稿hash、当前呈现/C10单元、实际C07/C10消费者、C07宿主与C10直接链/分页回归、权限/恢复/导航、typecheck/ESLint/静态构建、Chromium成功/拒绝/恢复及明暗×1672/1024/390列表/详情12组视觉/axe/geometry；`--verify`校验原始输入/日志/二进制/构建/网络/截图哈希。只做当前功能及直接影响回归，不递归上游、不运行数据库或覆盖率campaign。

reference BFF与合成身份/cookie/回环TLS/CORS桥接只证明本机组合；negative probes明确标注。生产凭据/目标DB/Storage/真实provider/推送/部署未用。IMPLEMENTED_PENDING_ACCEPTANCE，INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。真实IdP/cookie/CORS、Supabase/RLS/事务、真实风险源、长期SSE/持久恢复、多浏览器/跨OS、人工读屏/native200%、远程同SHA CI、性能容量长稳、完整I4/RELEASE均NOT_RUN。下一原任务FE:UI-503 Trade Ticket preflight；I4窗口不自动升级READY。
