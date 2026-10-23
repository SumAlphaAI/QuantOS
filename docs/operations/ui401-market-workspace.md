# UI-401 Market Catalog、Watchlist、VenueQuote

依据前端执行计划 I4 UI-401 / C12。实际路由 `/markets` 已接入 TerminalFrame 和 Markets 导航，生产页面只消费公开生成 BFF client / Zod，未引入 fixture、私有服务或数据库 SDK。UI-P18 高保真、标的详情、告警偏好、candles/history/realtime 留给后续任务。

## 目录与报价事实

从 C01 session/context 取得相同 actor/tenant/workspace/account/mode/environment/MFA/capabilities，要求 `market.read`，有效期取两者及已有期限最小值。既有 route monitor 监听权限撤销、scope、过期、离线、隐藏、失焦与有界 C01 复核；失效关闭请求并清空目录、价格、自选和恢复意图，恢复必须显式重新读取，禁止重放写入。

读取 C12 catalog、watchlist，再按每个 instrument 的 symbol/venue/product 请求精确 VenueQuote。目录上限 256（与 live catalog 界限一致），请求顺序有界；同 canonicalSymbol 的不同 venue/product 以 instrumentId 独立展示，不拼接、不聚合价格。C12 当前仅支持 spot，未知产品由生成契约拒绝，不在前端转成 spot。搜索/venue/仅自选只过滤已读取目录，不宣称跨目录服务端搜索或全市场覆盖。

每行展示 source、venue/product、asOf、服务端 latencyMs、quality、sequence、capability（priceKind/topOfBook/intervals/timezones）、lotSize/minNotional、license/approvalRef/approvalVersion/dataSnapshotId。报价绑定 instrumentId、canonicalSymbol、productType、provenance.venue 和目录规格；空许可/来源/审批、未来时间、无效精度、缺失盘口、重复身份、多条/错维度报价均拒绝。任一目录/自选/报价读取失败，清除本次可用视图，不将部分结果标记完整成功。空目录/筛选结果、加载、错误、无权、离线和陈旧快照有明确状态。

金额按原始十进制字符串展示，不转 JS Number、不计算跨市场最优价；last_trade 的 bid/ask/mid 保留空值，不合成价差。报价始终不可执行，无下单或部署操作。quality 按服务端事实显示；asOf 超过两秒额外显示“陈旧快照，请刷新”，不是行情流或许可更新证明。latency 明确为服务端快照值。费用/滑点暂无可用估计。此任务不打开行情 stream；权限 stream 仍来自既有 C01 monitor。

## 自选写入与恢复

`market.watchlist.write` 才能编辑和保存，C12 live 的 Viewer 拒绝仍由服务端执行。最多 100 个唯一 instrumentId。保存发送准确 instrumentIds，附原 If-Match、UUID Idempotency-Key、CSRF 和 request ID；请求期间同步 busy 锁阻止重入。成功必须返回与提交内容一致的列表、新 objectVersion、auditRef/correlationId，页面链接实际 Audit Explorer。不会把 HTTP 成功但内容不匹配当作已保存。

409 VERSION_CONFLICT 保留本地选择，显式读取 head 后才允许“保留本地选择并重新审阅”或“采用服务端选择”；读取和解决冲突都不写，保留本地后仍须显式保存并生成新意图。明确拒绝不自动重试，429 有界冷却（包括结果未知后的重试）。网络/超时/5xx/畸形成功导致结果未知，保留原 key/body/version，锁定编辑、刷新和放弃，只能显式重试原请求；重试的 C01 预检失败也保留原意图。恢复键仅在内存，离开会提示且清除，不宣称跨页面/崩溃恢复。

目录未返回的已保存引用保留并明确展示，不静默截断；用户可显式移除不可见引用后再保存。放弃只还原本地编辑；未提供删除业务事实或测试数据清理功能。

## 本机真实模块组合与验证

reference BFF 原 C01 未声明 market 权限，且只允许 current 身份访问 C12。现补齐 current 的 read/watchlist.write 与 viewer 的 read，viewer 可读取 synthetic 目录/报价但自选与 current 隔离，PUT 始终拒绝。此修改仅作用 reference 模式，不改 live 身份、权限、数据库或许可策略。

`node scripts/ui401-review.mjs --run docs/audit/evidence/ui401-local-20261023/attempt-NN` 在源码冻结提交后运行，隔离继承环境、禁止注入数据库凭据，记录完整候选 SHA、逐文件输入摘要、命令/退出码/原始日志、Rust binary、Terminal 构建产物、Chromium 网络记录/截图/axe；`--verify` 检查源码、日志、命令、产物摘要、场景数量、阶段边界。已有目录不可覆盖。preflight 与失败 attempt 原样保留；源码变动须冻结新候选并使用新 attempt。

验证范围仅 UI401 policy/runtime、新 runtime 到实际 reference C01/C12/R01 的 consumer、原 C12 consumer/MarketSeriesRecovery/route monitor 直接回归、C12 Rust 专项、C01 session 直接影响、types/lint/rustfmt、一次 Terminal build 和 Chromium。不会递归重验上游、运行全仓、全量覆盖率或数据库 campaign。浏览器临时 TLS、cookie 注入与 CORS proxy 明确为测试替代；只允许 loopback。合成空目录/422/响应丢失和浏览器错 venue 注入均明确作为负向测试，不冒充真实目标故障。C12 fixture 数据不是外部实时行情或真实许可批准。

DEVELOPMENT：功能实现及有界 reference 工程证据；development_status=`IMPLEMENTED_PENDING_ACCEPTANCE`。完整 INTEGRATION stage_gate 保持 `NOT_ASSESSED`，formalAccepted=false、runtimeAdmission=DENIED，不自动升级历史依赖/159 项门禁或声称当前 HEAD 正式通过。下一原任务 `FE:UI-P18`。

真实 IdP/Cookie/CORS、Supabase RLS/事务/持久化、外部行情/许可、真实持久恢复、生产托管、Firefox/WebKit、人工读屏/native 200%、跨 OS、同 SHA 远程 CI、性能/容量/长稳、完整 I4 联调和发布全部 NOT_RUN；UI-P18 高保真与 candles/图表/行情流不在本功能范围。无生产凭据、推送、部署或外部发布。
