# TP06 自有策略生成参考与替换边界

日期：2026-10-15。决定：继续交付 QuantOS 原生 `strategy-lab`，不导入或采用 VibeTradingLabs/vibetrading 的外部源码、依赖、凭据、服务或发布制品。本轮没有重新调查远端仓库或作许可证/安全采用结论。任务中的上游名称仅是参考/适配候选标识；未来采用需固定候选字节并另行审查。

生成、静态检查、回测分为三个边界。`StrategyGenerator.generate(prompt, fixture_name)` 只返回声明式策略数据；自有 fixture 实现按明确 fixture 名选取，prompt 仅用于边界检查和哈希，不声称理解任意自然语言。替换 provider 由可信宿主构造注入，不能由请求传入代码、地址、客户端或工具。生成器是进程内可信 Python 代码，不构成执行恶意插件的沙箱。

QuantOS 对所有 provider 结果统一运行静态检查：唯一 DSL `momentum(close, lookback=N)`、有界整数阈值/回看、正有限名义金额与唯一合法标的。任何 finding 都产生阻断草稿/check Artifact，不自动创建 StrategyRelease。Rust 消费者重新核对检查明细、DSL及notional/universe的范围/格式/唯一性，拒绝缺失/矛盾标志和整数极值；仅运行原生 MomentumAdapter，不 eval 任何生成源码。此参考适配器做单标的固定数量的回测评估，notional/universe 是草稿元数据；组合仓位与标的映射验证归 S02，不可将其当作交易约束执行器。

Execute 与最终 StreamExecute 只原子写入内存中一对不可变 Artifact，并返回其引用/内容摘要；重复完全相同的请求复用同一字节，冲突不部分写入。读回由可信宿主按租户/工作区/id索引，不提供公开读取 RPC。artifact:// 是本地引用；不是 Supabase 上传成功证明。取消按租户/工作区/actor/执行索引，阻断后续提交；已提交内容不可被取消删除。身份 metadata 必须由宿主完成认证和授权，直接客户端自称的 capability 不是登录凭据。

本地 UDS、独立 Python 进程、Rust 实际回测消费者、独立100攻击语料、100替换生成失败与100消费者失败证明开发边界。内存容量/重启丢失、生产身份、真实模型、持久Artifact、OS出网隔离、目标部署、安全/负载/长稳与同SHA hosted CI均待测试和Beta验收。本轮不授予生产、外部发布、上游采用或正式ACCEPTED。
