# CORE:R01 Market ingestion 与标准化行情契约交付摘要

日期：2026-10-02。状态：FIX_VALIDATION；9 项复审问题关闭，B01 真实 provider 验收待完成，R01 未 ACCEPTED。

- MarketEvent v2 使用显式标的映射与 BASE/QUOTE；来源身份包含 tenant/provider/ID，并对同 ID 的不同内容报冲突。原始数值错误产生质量事件，坏帧隔离后继续处理。
- `ingest-source` / `poll-source` 将 receipt、序号、事件、审计和 F05 outbox 原子写入配置的 Supabase；重启去重、失败安全重试、F05 inbox/checkpoint、死信重放已有目标 fixture 测试。
- 实际 processing clock 与持久 watchdog 检测积压和断流；历史 replay 明确使用 fixture 时间。稳定及 nightly 覆盖按生产文件单独检查，门槛为 line ≥90%、region ≥85%、branch ≥85%。
- Replay 限 100,000 条、frame 限 16KiB，非法 spec 返回错误；本地领域/CLI 测试与真实编译 mutation Gate 阻止回归。

完整修复状态、计数、覆盖及 Supabase 回执见 [整改验证报告](./audit/R01-remediation-validation-2026-10-02.md)。[全面复审报告](./audit/R01-comprehensive-review-2026-10-02.md)保留修复前历史结论。

使用 [摄取 Runbook](./runbooks/r01_market_ingestion.md)配置必要 trace sink、有效 tenant/actor、受控审批文件。当前工程缺真实源连接与批准记录，[provider 获取与审批指南](./runbooks/r01_provider_onboarding.md)说明官方渠道及内部申请流程。公共入口可访问不能代替使用许可；原生 API 必须由 adapter 转为 JSONL。

本地领域 PASS、Supabase fixture PASS、CI 工作流存在与正式供应商验收分别记录。未执行真实供应商、部署端告警与远程同 SHA CI 验收，不能据此声明 R1 服务 Gate 通过。
