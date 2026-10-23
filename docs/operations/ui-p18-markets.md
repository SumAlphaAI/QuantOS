# UI-P18 Markets Overview / Instrument Detail

依据前端执行计划 I4 UI-P18、P18 v2 视觉参考、C12/C16 与 ST/ACC-P18。实际路由 `/markets`、`/markets/:symbol`；symbol 使用一个规范编码段，例如 `/markets/BTC%2FUSDT?venue=coinbase&product=spot`。静态宿主仅把严格编码的规范化 symbol 映射到 markets.html；客户端再次检查 query、重复参数及 venue/product，未知/畸形输入不发鉴权/业务请求。目标托管 rewrite 验收仍 NOT_RUN。

## 页面结构与事实适配

复用 UI-VIS-000 的 ThemeProvider / TerminalFrame / Header / Navigation 与 PRE02 tokens。1672px 是自选侧栏—市场目录/逐venue比较—标的详情三栏，1024px 把详情移至下方，390px 保留可滚动语义表格、堆叠详情和明确空/错误状态。表格选择和实际详情 URL 共用精确 symbol/venue/product，前进/后退与 reload 可重放；没有自动执行 venue。最近访问仅内存，scope失效清除。搜索/venue/计价货币/quality/自选/最近筛选、列密度/来源列设置和保存筛选可用。localStorage 只白名单保存界面偏好，不保存价格、会话、授权、账户、数据源结果或恢复键；篡改偏好不能增加权限。

每行仍展示/提供 source、venue/product、asOf、latency、quality 和 capability/许可；规格与详细许可/审批/快照位于选中 instrument 的数据血缘区。VenueQuoteTable 明确按来源/产品分行，展示 bid/ask/mid、服务端规格/质量/时间和费用/滑点可用性；spread 仅使用 BigInt 十进制差计算，不评选“最优”市场。金额仍保持原始字符串精度。

当前 C12 仅支持 spot、非执行报价，未返回 24h change/volume/high/low、tickSize、交易开放状态；C16 没有按 symbol 的价格阈值或独立“数据陈旧”订阅字段。图中的对应指标显示“— / 未返回”，不补静态演示数值、不画虚构 sparkline，不声称 Trading/Tradable/最佳执行。UI-P19 K线工作区和后续交易单路由尚未交付，对应按钮有明确禁用原因；不会产生死链接、默认交易 venue 或订单。高保真以布局、层级、密度、状态和交互为适配依据，不声称像素相等或字段已被服务端提供。

## 读取与报价流

沿用 UI401 C01 权限/期限、scope绑定、route monitor 和显式重读；不另造身份或许可。UI401 runtime 保留默认整批拒绝行为，P18 显式启用 partialQuotes：catalog 和 watchlist 失败仍清屏；单来源403/503/网络/畸形响应只保留该 instrument 最小目录元数据，清除其价格，不阻塞其他来源；全局401/会话失效与权限流撤销仍清除全部并关闭请求。无报价许可的行不能成为交易上下文或生成血缘快照链接。

选中获授权 instrument 才打开 C12 quote stream，带精确 symbol/venue/product。完整 VenueQuote 快照按 sequence 去重/替换，校验 envelope、streamId、维度、source、approval版本及snapshot；不拼接不同来源或产品，切换时立即按 instrumentId 隔离旧 feed（包括首帧），关闭旧请求。帧上限64KiB、空闲期限有界；EOF/网络失败冻结最后确认快照并标 disconnected，不把有限reference事件流称为持续实时。显式重连复用该流的 sequence/streamId；reset/409需刷新市场重新取得事实，不自动拼接。权限撤销清除数据；没有无限重连。

报价 age 超过两秒标记陈旧，但不改变服务端 quality 字段。latency 标明服务端快照；行情流仅更新当前选中来源，其他比较行仍为各自独立快照，不声称同一撮合时刻。

## C12 / C16 写入

自选沿用UI401的 If-Match、原幂等键、CSRF、内容匹配、busy锁、409显式审阅、429冷却和结果未知恢复；P18未削弱旧38项功能用例。不可见已保存引用不会静默删除。

C16 仅在 C01 `alerts.read` 下读取和保存当前用户的 subscriptions。本页只修改 `market` 域成员资格，完整保留其他域与severity顺序。没有单标的规则接口时不伪造价格/陈旧阈值。唯一域为market时不能保存空域，符合当前C16约束。

保存前重新验证C01，携带准确If-Match/Idempotency-Key/CSRF/requestId；成功必须有匹配的完整内容、连续版本、auditRef/correlationId。网络/5xx/畸形成功保留原key/body/version，只能显式重试；C01预检失败也保留恢复意图。409保留市场选择，显式读取head后可基于最新的其他域/级别重新审阅，随后再保存；不拿旧数组覆盖并发修改。采用服务端状态不写；429包括未知结果重试均有冷却。

reference Viewer 有 market.read 但没有 alerts.read，C16应403并显示不可用；不为视觉效果扩展权限。另一个获授权Owner的偏好保持隔离。离线/隐藏/权限过期清除目录、价格、告警草稿与内存恢复意图，恢复仅显式读取，不重放写入。离页有未保存/冲突/未知写入时提示；不提供跨页或崩溃恢复承诺。

## 验证与阶段

`node scripts/ui-p18-review.mjs --run docs/audit/evidence/ui-p18-local-20261023/attempt-NN` 冻结新源码候选后执行；`--verify` 复核源码输入、原始命令/日志、binary/build hashes、C12/C16网络副作用范围、15项实际Chromium场景、12组视觉/axe和三栏几何。已有attempt不能覆盖。临时TLS/cookie注入/CORS代理和市场fixture都明确为本机替代；实际使用生成consumer、reference BFF、R01/C12/C16，不使用生产凭据或数据库。

仅运行P18、UI401、自选/行情consumer/recovery、route monitor的直接回归，C12专项与C16订阅/流绑定专项、路由/门禁测试、types/lint、一次Terminal build及专用Chromium矩阵。没有递归全部上游、全仓、全量覆盖率、F05/F07 campaign或目标数据库操作。

development_status=IMPLEMENTED_PENDING_ACCEPTANCE；工程结果仅本机reference功能与视觉结构范围。INTEGRATION stage_gate保持NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED；历史UI401及其原始失败/NOT_RUN不改绑。真实IdP/Cookie/CORS、Supabase/RLS/事务持久化、外部市场许可、目标恢复/托管、Firefox/WebKit/跨OS、人工读屏/native200%、远程同SHA CI、性能/容量/长稳和完整I4/RELEASE全部NOT_RUN。下一原任务FE:UI-501。
