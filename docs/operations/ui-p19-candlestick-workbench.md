# UI-P19 高保真 K 线与市场分析

依据 I7/UI-P19、P19 v4、Terminal Design Spec P19、ST-P19-01–05、ACC-P19-S1–S7；沿用UI-402 C01/C12/C09事实与权限边界。状态IMPLEMENTED_PENDING_ACCEPTANCE；本机工程Gate不授予正式INTEGRATION/RELEASE，stage_gate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。

## 页面与视觉

实际路由 `/markets/:symbol/chart`，规范例 `/markets/BTC%2FUSDT/chart?venue=binance&product=spot&interval=1m&timezone=UTC`。复用ThemeProvider/TerminalFrame/TerminalHeader/TerminalNavigation、PRE02/UI-VIS tokens，不另建Shell或装饰性风险状态。桌面按原稿分为图表+OHLCV/缺口主列、分析设置、数据状态三栏；1024移数据状态到下方，390纵向堆叠，图表保留至少960px横向滚动区域，避免缩成不可阅读的小字。1440是共用视觉基线，另记录1672/1024/390及双主题。

顶部为规范标题“K 线”及说明“历史 K 线用于分析，不构成交易建议。”；上下文条提供Symbol/Venue/Product/Timezone/Quality与7个周期按钮和“自定义”。当前C12只允许spot，venue/timezone/周期根据授权catalog禁用不支持选项，不提供假的perpetual能力。自定义是成对ISO范围及七种聚合中的一个，最多31日/500根；无效输入不派发查询、不生成带undefined字符串的深链。

Quality是已返回数据的显示筛选，不发送不存在的服务端质量参数；不匹配时隐藏图表、表格及已选Candle引用，但保留原质量元数据和明确说明。筛选不能将degraded改为passed。

## 图表、指标与事件

原生SVG按时间坐标绘制OHLCV/成交量、缺口带、十字准星、移动平均/VWAP/RSI与订单/成交。移动或点击图表选择最近的实际Candle，缺口不补K线；键盘Left/Right/Home/End选择，表格行按钮同步选择；“跟随十字光标”控制表格25行分页。放大/缩小、前后查看、重置及全屏为本地显示行为，不产生业务写入。低于5根（包括1W单根）也正常显示。

受控指标：SMA/EMA周期2–200，EMA以首个完整窗口SMA初始化；VWAP为HLC3×bar volume的日内加权近似，按聚合时区午夜及缺口重置；RSI使用Wilder14，连续14次价差后才有值，缺口后重新预热。零成交量不推断VWAP，持平RSI=50。浮点只作可视化，价格、数量和表格保留原始十进制字符串。不开任意脚本执行能力。

指标和事件标签支持键盘切换；Orders/Fills/Data gaps独立显示开关，Research没有C12/C09事件源，明确不可用。缺口事实列表始终可见，关闭阴影不移除缺口警告。C09仍需execution.operate、paper/shadow及同账户/模式/venue/venueKind/product/symbol；标记是带读取时间快照，缺product和Paper/mock不得映射成真实spot成交，202不是成交。

## 状态与恢复

加载显示骨架并清空原series/指标/标记；切市场、产品、周期、时区或范围取消旧请求，generation及页面读取序号阻止迟到响应重新显示或触发新维度续传。相同维度刷新遇到已确认HTTP503/504，在当前身份仍有效时恢复最后确认只读图并清除标记，提示未推进asOf；换维度、无效schema/元数据、401/403或时效失效不能借用旧图。默认UI402 runtime行为不变，保留是P19显式opt-in。

C12完整replaceSeries语义、afterSequence/streamId续传、冲突帧/409重读、冷却及有界帧均延续UI402。EOF或断流固定最后确认时间，显式续传。离线/隐藏/焦点/到期/失权终止请求并清空行情、标记与已选Candle；离线页只保留最后确认时间文字，无领域持久缓存，重新核对身份后仅重新读取。

## 保存、复制与受控能力

“保存分析视图”只白名单存quality、受控指标、事件可见性及follow显示偏好；不保存symbol/账户/模式/价格/行情/授权/token/恢复键，损坏或篡改输入回到安全默认。存储不可用只提示，不阻塞读取。

“复制安全深链”仅复制已应用市场维度，不使用未提交的范围草稿；Candle引用仅包含实际成员时间、series维度、source/asOf/snapshot引用，不带价格、账户或授权。Quality不匹配或没有有效Candle时禁止复制Candle引用。

从选定Candle打开Trade Ticket只预填规范标的到`/trade/:symbol`，不带委托价格/账户/模式/授权，不选默认执行venue、不创建订单；后续Trade页面重读当前权限/服务端上下文并重新选择已授权venue。无execution.operate时入口不可用。

C12提供dataSnapshotId，可进入授权快照页面；未提供correlationId，不伪造Audit链接。没有独立签名核验或完整用途许可回执，显示“结构已校验”和原license标签，不冒充verified/License passed。

受控C12片段/图像导出尚未实现：当前C10 ExportScope基于correlationIds/eventKinds，format仅jsonl/csv/pdf，不能表达CandleSeries的venue/product/interval/timezone/snapshot范围；C12没有correlationId供该范围绑定。页面禁用导出并解释，未直接下载以绕过许可/审计。P19-C10-EXPORT-01按原P1范围保留，不作为UI403等无关开发前置。

## 验证、风险与下一任务

冻结后入口：`node scripts/ui-p19-review.mjs --run docs/audit/evidence/ui-p19-local-20261024/attempt-NN`；复核：`node scripts/ui-p19-review.mjs --verify`。执行页面/指标/保存范围单元测试、实际reference consumer、UI402直接浏览器回归、typecheck/lint/build、路由/门禁与计划检查；不重跑整条依赖链、全仓或数据库campaign。

真实C09→C12阳性仍为UI402-MARKER-SOURCE-01 NOT_RUN；合成rich K线及明确spot标记仅验证消费者，不代表真实外部行情/成交。保留UI402历史源包与失败原字节，ORIGINAL_SCOPE_ONLY不改绑。IdP/Cookie/CORS、目标DB/托管、外部provider/用途许可、Firefox/WebKit、人工读屏/native200%、跨OS、同SHA远程CI、性能容量长稳、完整I7/G4/FEP-4及RELEASE均NOT_RUN。axe incomplete和实际浏览器/截图结果见当前证据包，不声称完整无障碍验收。

下一可执行原计划任务：FE:UI-403（Performance、归因、周期报表）。
