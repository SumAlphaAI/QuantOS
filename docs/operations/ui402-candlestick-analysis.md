# UI-402 OHLCV 与订单/成交标记

本任务是 I7 的前端功能开发交付，状态 `IMPLEMENTED_PENDING_ACCEPTANCE`。正式 `stage_gate=INTEGRATION/NOT_ASSESSED`、`formalAccepted=false`、`runtimeAdmission=DENIED`。不构成 G5/G4/FEP-4 或目标环境准入。

## 使用

从 `/markets` 标的详情的“查看 K 线”进入 `/markets/BTC%2FUSDT/chart?venue=binance&product=spot`。托管使用 `terminal-route-map.json` 中精确 chart 路径映射到 `markets/chart.html`；未声明主机需另行实现相同规则，目标托管验收 NOT_RUN。

C01 会话和上下文决定账户、模式和权限，URL 只选择市场维度。支持目录允许的 Symbol/Venue/Product（目前仅 spot）、1m/5m/15m/1h/4h/1D/1W 和 UTC/Asia-Shanghai；开始/结束为成对 ISO 时间，自定义表示时间范围，最多500根，由服务端限制31日。没有额外自创聚合周期。

OHLCV、成交量、缺口事件和全部 series/provenance 字段来自 C12。原始表保留十进制字符串；SVG 坐标和 SMA/EMA 使用浮点数，不能作为资金、执行价格或风控事实。指标以 close 计算，period 为2–200整数，EMA用首个完整窗口的SMA初始化；缺口后重新预热，不补K线、不跨缺口连线。图形时间轴按UTC标注，聚合时区及原始时间另行展示。

切换 symbol/venue/product/interval/timezone 或读取新范围时，先同步清空原K线、指标和标记，并取消旧请求。generation 令迟到响应不能回填。catalog校验能力；schema、来源、时间排序、OHLC高低关系、缺口覆盖与事件一致性校验失败时不显示旧数据。

C12流为完整 `replaceSeries`，允许全局交易序号跳跃，不拼接不同series。初次从afterSequence=0获取受绑定streamId，之后显式续传携带最后确认sequence及streamId。EOF/错误/idle timeout停在最后确认asOf，409需重新读取整个序列。冲突重放、来源/审批/快照变化、异常帧、截断UTF-8、超限帧均不得推进事实。429冷却禁止立即重试。页面不自动产生订单或成交，不自动重连形成无限循环。

C01 permission/上下文变化、过期、离线、隐藏/焦点失效沿用route-access策略：终止请求并清空全部行情和私有标记，显式重新核对身份才恢复读取。

## C09 标记及来源边界

`execution.operate` 及paper/shadow身份下按当前账户有界分页读取C09；没有权限时行情仍可读，标记显示不可用。最多500个订单/20个分页游标，重复游标或异常响应拒绝整组标记；普通C09读取失败保留C12，但清空标记，401/403清空整个页面。

为避免缺失产品的订单被推断为spot，Order新增向后兼容的可选 `productType: spot`。旧生产者可继续省略，消费者显示排除计数，不伪造来源。标记必须匹配account/mode/venue及venueKind/product/symbol；仅在已选spot上下文内允许规范symbol或去斜杠的C09 symbol。订单以submittedAt/quantity/status、成交以Fill.at/price/quantity绘制并链接到原orderId，保留correlationId；无订单价时画时间标记，不使用均价伪装订单委托价。202回执从不视为订单或成交。

标记是明确标注读取时间的C09快照，通过“读取范围 / 刷新”重新读取，不宣称订单流实时性。当前实际reference订单仍是OWNED_PAPER/mock且没有产品维度，不能叠到binance/coinbase spot。单元/Chromium显式合成spot输入证明绘制阳性；真实C09→C12阳性接续保留 `UI402-MARKER-SOURCE-01=NOT_RUN_COMPOSED_SCOPE`，不作为UI-P19等无关功能开发前置。

## 验证与范围

复核：`node scripts/ui402-review.mjs --verify`。冻结源码后生成新证据：`node scripts/ui402-review.mjs --run docs/audit/evidence/ui402-local-20261024/attempt-NN`（不得覆盖attempt）。工具白名单环境只含本机公开配置，生产凭据不传入，实际reference HTTP/TLS及Chromium可能需要本机端口权限。

直接影响回归覆盖市场目录入口/精确静态路径、UI401、UI505、P18呈现、C12 generated契约和18项C12 Rust测试；不递归重验上游或全仓。当前任务与父源码比较的OpenAPI兼容性检查验证可选字段不收紧既有要求；旧75a563c基线88项FAIL保留在preflight-01，不作为本任务PASS。

原预检schema断言失败、沙箱EPERM、浏览器控件标签失败及中断保留，后续通过仅适用于新源码/输入。UI-P19高保真、真实IdP/Cookie/CORS、Supabase/RLS、真实market/venue/license、Firefox/WebKit、人工读屏/native200%、同SHA远程CI、目标托管、性能容量长稳、完整I7联调和发布全部NOT_RUN。原UI401/UI505/G5等历史证据仅 `ORIGINAL_SCOPE_ONLY`，不改写或改绑为本候选通过。

下一可执行原计划任务：`FE:UI-P19`，实现P19高保真页面与交互验收。
