# TP08 Qlib development — 2026-10-10

当前状态：工程实现完成，F05/F0 必要依赖闭包及 TP08 DEVELOPMENT 准入待刷新；formalAccepted=false。

范围：固定来源六文件静态复核、三项自有合成离线实验与当前 proto/schema/真实字节证据；结论 reference_only，无 Qlib adapter。完整 Alpha158、LightGBM、MLflow、实际 Runtime、持久存储和生产运行均未执行。

原映射占位哈希、过弱字段测试和将 Git SHA-1 标为 SHA-256 的 SBOM 已整改；原件及首轮错误日志保留于 [initial](./evidence/tp08-20261010/initial/)。首轮指标预期手算错误，由独立 Fraction 复算确认 21 样本 MAE=0.024856891860540044，取八位 0.02485689；两处 Decimal 推导类型问题修复后复验。

交付：third_party/qlib 的实验/fixture/映射/实际对象/来源记录/许可证和 CVE 记录；当前映射测试；scripts/tp08* 来源、schema、生产排除及回执校验；统一 provider-a1 policy/recorder 与构建入口；ADR、能力矩阵、进度与双计划。

未决：解析依赖图和当前 advisory 未执行，运行时 DENIED；真实数据用途许可未授予；F05/F07 性能/Release 风险待当前目标实测记录；无 hosted CI、外部发布或正式 ACCEPTED。本任务不新增生产凭据动作或本地数据库。
