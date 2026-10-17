# X05：Shadow、四域对账与带复验的异常关闭

状态：当前功能实现；真实行情持续运行、完整业务联调及发布另验。依据X05任务卡、最新AGENTS.md和分阶段测试规程。

## 边界与信任

新的可信API位于`model/shadow/reconciliation/exceptions`；root/legacy接口只作历史合成fixture兼容，无新的业务权限。ShadowRunner只持有专用Shadow RiskGuard、Scope和内存状态，不持有issuer、execution gateway、venue adapter、网络/数据库client或任意工具callback。新的离线worker只处理提供的字节，不能生成Command、调用内核或修改对账事实。源码禁用路径、编译期无submit方法和原生协议拒绝测试相互补充，不将硬编码计数器当零提交证据。

AuthContext必须来自可信后端当前会话解析；检查Shadow模式、当前capability、角色和tenant/workspace/account。owner可使用无固定账户上下文，其余角色必须绑定账户。RiskGuard在建议生成时观察实际X01/S03/财务/venue来源，在虚拟成交提交前同一锁内重验当前Allow；仅是Shadow比较，不提供执行权限。审批阈值或风险拒绝不消费审批，不生成可模拟成交的Allow。

行情必须有symbol、正Decimal价格、来源引用、非零序号和非未来时间，最多60秒，序号或来源时间不得回退/同序号冲突。新行情使旧建议无法产生新的虚拟成交；已存在成交可在当前风险仍通过时幂等读回。建议ID/成交ID分属shadow命名空间，不能传作真实TradeCommand或VenueOrder。时间、行情许可、scope与seed/现金真实性依赖后端，目标身份/许可证据未执行。

## 账本与独立对账

基线seed明确开窗持仓、累计已实现PnL、现金与成交序号。Decimal输入最多18位小数，乘除结果按18位银行家舍入；买入为现金流出，卖出为流入，费用扣现金和已实现PnL；平仓及多空反转只实现被关闭数量，反转剩余部分采用新成交价。未实现PnL和gross exposure按当前mark估值，不把成本当市值。X01浮点转换显式舍入，比较容差默认1e-8、最大1e-6；不支持隐式多币种/FX、入出金、公司行动或衍生品保证金。

两路book须同scope/day/seed、不同且同日稳定的来源身份，并声明revision/抓取时刻及来源hash。来源revision不能回退，相同revision不能改内容。输入有重复ID、非正成交、负费用、孤立Fill、Command/Order/symbol/side关联错误、未来数据、跨账户、过大容差等时直接拒绝，不返回“零差异”。X04适配重放完整事实/anchor，核对每个Order账户与每个Fill的Command/quote；X01适配验证快照并要求每个position的行情来源。X04事实缺tenant/workspace字段，不能独立充当租户授权证明。

两路比较后，对每路独立从seed和Fill顺序重建数量、成本、PnL、现金和exposure，并核对订单累计成交/均价、Fill序号及每个仓位的估值。这样两路同样错误也不能靠相互相等通过。差异按以下20类定位；缺失检查对双方ID并集执行，数量相同的替换/多余记录也不能被忽略。

| 类别 | 实体定位与来源 |
| --- | --- |
| OrderCountMismatch / OrderStatusMismatch / OrderQuantityMismatch / OrderPriceMismatch / OrderMissing | orders集合或order_id；状态/身份、数量、累计Fill及均价 |
| FillCountMismatch / FillQuantityMismatch / FillPriceMismatch / FillFeeMismatch / FillMissing | fills集合或fill_id；数量/价/费和Order/Command关联 |
| PositionQuantityMismatch / PositionPriceMismatch / PositionMissing / PositionUnrealizedMismatch / PositionRealizedMismatch | positions/symbol；双路及独立重建、mark估值 |
| LedgerPnlMismatch / LedgerExposureMismatch / LedgerBalanceMismatch / LedgerSequenceGap / LedgerStaleMark | ledger/pnl、exposure_gross、cash、sequence、freshness；含抓取和逐标的mark时刻 |

每条差异包括expected/actual、两路source_ref、输入/报告摘要、observable_at与detected_at。受控测试从注入可观测时刻量测≤900秒；实际检测延迟须由真实部署的来源可用时刻/采样链验证，不能将立即写入一个时间字段包装成真实SLA。超时仍记录breach，不丢告警。10个受控工作日样例不代表10个真实交易日。

## 异常与恢复

稳定异常ID绑定scope/day/kind/entity；新run观察同一差异更新原记录并递增revision，避免重复队列项。相同run key和相同输入重放返回原报告，不重新提升旧报告为latest；不同输入同key拒绝。每次新观察都会撤销旧ack/closure，关闭后复发自动reopen并使日结失效。

ack与close均采用CAS并检查当前权限和单调时钟。close必须先ack；使用同日同来源的最新报告，报告在ack后重新抓取且足够新鲜；来源revision至少一路已推进、不回退；覆盖原实体且原差异不再存在；resolution非空。删除两边记录来逃避复验不能关闭对应实体异常。close不改任何账务。日结要求最新完整报告零差异且该日没有未关闭异常。

追加动作journal记录actor、时间、动作、序号、前hash与当前hash；独立可信anchor含数量和末hash。恢复只接受scope匹配和可信anchor，逐条重新执行业务规则与报告计算，恢复CAS/幂等/日结状态，不信任外部反序列化的“已关闭”投影。当前是内存服务和显式导出/恢复，限制10000动作/8MiB，容量前拒绝；没有自动持久落盘、Supabase事务、分布式单写者或已部署调度。hash不证明历史操作者身份，anchor与日志同时被伪造不在本地完整性保证内。

## 阶段验收

只执行X05与直接只读消费者/工具/计划影响测试，不修改X01–X04运行时代码，不重新跑其全闭包。Cargo.lock/Makefile/共享门禁契约变化使X04当前独立Gate输入不再完全匹配，撤回其独立READY，保留原源码和原始回执；不把本轮只读回归改绑成上游READY。真实行情/许可、连续窗口、目标20类时效、Supabase/RLS持久事务与跨实例恢复、安全/性能/长稳/同SHA CI及正式用户确认独立保持NOT_RUN/PENDING。

Mark.sequence为可信后端归一化的QuantOS观察游标，seed使用X01快照末游标；接入新行情时须推进该游标，不直接混用venue/provider的独立序号。来源引用可定位原始记录，真实feed的游标规范化与许可接入仍须单独集成验收。
