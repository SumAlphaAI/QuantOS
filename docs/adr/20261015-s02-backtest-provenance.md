# S02：固定候选的历史回测与成本核算

状态：本地开发实现；真实部署、持久化和发布验收独立 NOT_RUN。

`BacktestRequest` 显式固定完整源码 SHA、执行制品 digest、runtime digest 与 clock。受信任宿主构造这些字段；hash 是来源绑定，不能证明提交已审查或授予发布权限。输入 hash 包含 Snapshot ID/tenant/hash、序列 hash、全部生效参数、草稿版本、候选、warmup 与成本模型。环境 hash 包含引擎 v2、执行/终值策略、初始现金 100000、成本和候选。报告 hash 覆盖除自身以外全部字段，包括输入/环境/参数 hash、版本、逐笔成交与泄漏摘要。serde_json 启用 float_roundtrip，保证报告写入/读回后仍可验证，避免浮点解析改变报告字节含义。

Snapshot 是事先完整固定的历史数据集，window 覆盖全部 K 线；capture 不早于 window end，且不得晚于固定执行 clock，clock 不得超过过期时间。历史数据集的 capture 可以晚于历史决策时间，不能把归档时间误当特征可用时间。引擎分别检查每根 K 线的连续 index、严格时间顺序、窗口/clock 范围及有限正 OHLC；序列的内容 hash 重新计算，`data_hash = sha256(canonical_json({symbol,bars}))` 必须存在于 Snapshot 的 Artifact 引用中，避免只复制 Snapshot hash 即可替换数据。数据集质量须 Passed 且无 findings；S01 消费入口另按可信目录和策略用途规则复核来源/许可/新鲜度。

Adapter 必须显式提供全部有效配置与 reset；每次回测重置原生规则状态，复用同一adapter也能确定性重放。`DecisionContext` 对每次读取记账，任何未来 index（包括越界尝试）均拒绝。Native adapter 是可信代码，不能从该机制推导出进程沙箱或对任意隐藏外部状态的防泄漏保证；不执行用户提供的代码。收盘信号仅在下一根开盘执行，终根信号不成交，剩余持仓按最后收盘估值，不强制清仓、不虚构退出费用。只支持单标的、long/flat、一次开仓/平仓；多资产、做空、部分成交、盘口冲击及真实费用校准未实现。

买入成交价 = open × (1 + slippage_bps/10000)，卖出成交价 = open × (1 - slippage_bps/10000)。费用按实际成交名义金额计算，滑点按参考 open 的名义金额累计；净盈亏由最终现金加持仓市值减初始现金得到，gross_pnl = net_pnl + fees_total + slippage_total，包含未实现持仓的参考价格收益。交易次数按实际 fills 数量计，不按信号数。拒绝非法数量、成本越界、资金不足和非有限运算；费用上限 10000bps、滑点严格小于 10000bps，warmup 至少保留两个决策点。Generated adapter 的 universe 在消费入口生效，买入数量被裁到 max_position_notional / fill_price；手续费额外计入现金检查。long 持仓不随重复 long 信号调仓，也不保证价格涨后市值持续低于初始开仓上限。

`DraftService::backtest` 是进程内组合入口：从已验证 AuthContext 检查 capability/tenant/workspace；锁内获取 S01 validation handoff 与对应不可变 head；对比可信目录中的整个 Snapshot、生成 Artifact 的 canonical hash 引用、TP06 静态检查及全部有效策略参数；生成带版本 hash 的报告。后续编辑不会改写旧报告；参数不一致时拒绝，恢复新版本后可重新回测。该入口不是公开 HTTP API，也没有宣称 Supabase Storage 落库或跨进程恢复。S03 仍须实际实现发布制品、审批与 Paper/Shadow 消费，报告 hash 本身不是批准。

本地验收覆盖同一候选 10 次报告/指标一致、50 次未来读取和 50 次 Snapshot 晚于 clock 拒绝、100 个数值/时序/字节/成本畸形输入拒绝、手算往返/终值成本、零费用、篡改/参数/环境变化，以及实际 Python UDS → Artifact → S01 → Rust 回测 → 参数拒绝 → 新版本恢复。真实进程用自有 fixture，不访问 live 模型、外部来源、数据库或生产凭据。TP08 等依赖通过新候选完整递归检查复验，本任务不声明将任意 TP08 因子映射为可交易策略。
