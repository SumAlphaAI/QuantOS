# X3-SERVICE：真实本地服务组合与独立账本对比

状态：本地功能准入设计。遵循最新AGENTS.md，不把聚合检查扩大为递归重验上游，也不把局部组合测试标为完整INTEGRATION。

新增execution-gateway集成测试组合真实X03/X02、SERVICE:X06、Paper/X04、X01与X05 Shadow/对账服务，唯一新增Cargo边为测试dev-dependency。命令/审批/事实权威继续由既有服务拥有，Shadow只产生非可执行建议和虚拟账本，没有issuer或kernel工具。固定黄金样本手算现金999000、BTC1010、ETH4000、gross501000、PnL0；只映射身份命名空间，不覆盖任何金融值。零费用异币标签没有兑换义务，修复X05适配器一律拒绝该情况的契约冲突；非零异币仍拒绝。

聚合验证同时覆盖20类差异完整定位/关闭/复发、当前权限和源新鲜度、kill及独立审批恢复、并发唯一与本地恢复。当前候选专有日志/LLVM/行为JSON完整绑定源码与输入，不接受历史READY作为依赖证明。必要回归为改动适配器两项来源测试、当前服务、dispatch、真实Paper进程及Agent/无submit边界；不执行S2闭包、旧10万事件、三轮构建或全仓测试。

九个依赖作为原范围参考；本Gate只对当前组合授予DEVELOPMENT READY，businessIntegration/releaseAcceptance保持NOT_RUN。正式ProjectUser确认、完整页面/BFF/全仓、Supabase/持久恢复、真实长期Shadow与目标性能/部署/安全/CI义务独立，runtimeAdmission=DENIED。
