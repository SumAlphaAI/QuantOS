# CORE:R01 Market ingestion 与标准化行情契约交付摘要

更新日期：2026-10-03。状态：FIX_VALIDATION；9 项复审问题关闭，B01 已完成 Binance 原生接入/真实补偿验证，正式 SLA、部署与许可验收待完成，R01 未 ACCEPTED。

- MarketEvent v2 使用显式标的映射与 BASE/QUOTE；来源身份包含 tenant/provider/ID，并对同 ID 的不同内容报冲突。原始数值错误产生质量事件，坏帧隔离后继续处理。
- `ingest-source` / `poll-source` 将 receipt、序号、事件、审计和 F05 outbox 原子写入配置的 Supabase；重启去重、失败安全重试、F05 inbox/checkpoint、死信重放已有目标 fixture 测试。
- 实际 processing clock 与持久 watchdog 检测积压和断流；历史 replay 明确使用 fixture 时间。稳定及 nightly 覆盖按生产文件单独检查，门槛为 line ≥90%、region ≥85%、branch ≥85%。
- Replay 限 100,000 条、frame 限 16KiB，非法 spec 返回错误；本地领域/CLI 测试与真实编译 mutation Gate 阻止回归。

完整修复状态、计数、覆盖及 Supabase 回执见 [整改验证报告](./audit/R01-remediation-validation-2026-10-02.md)。[全面复审报告](./audit/R01-comprehensive-review-2026-10-02.md)保留修复前历史结论。

使用 [摄取 Runbook](./runbooks/r01_market_ingestion.md)配置必要 trace sink、有效 tenant/actor、受控审批文件；Binance 原生 REST 使用下方专门 Runbook。[provider 获取与审批指南](./runbooks/r01_provider_onboarding.md)说明官方渠道及内部申请流程。公共入口可访问不能代替使用许可；JSONL `poll-source` 仍需标准化 adapter。

本地领域、Supabase fixture、Binance 真实源、CI 工作流与正式供应商验收分别记录。部署端告警与远程同 SHA CI 验收尚未执行；完整旧 R01 target 的八线程用例仍触及 Supabase 会话池上限，不能据此声明 R1 服务 Gate 通过。

## 2026-10-03 Binance 接入补充

用户决定先采用无需 Key 的 Binance 公共现货聚合成交。新增 `binance-rest` 原生 REST 命令、Supabase 原子页/持久游标、独立 transport watchdog 和受控授权记录。真实 BTCUSDT/ETHUSDT 摄取、停止/重启补偿、连续 ID/readback、重复与 F05 交付已有回执；详见 [接入验证报告](./audit/R01-binance-rest-validation-2026-10-03.md)。

B01 的 native adapter/真实来源执行缺口已补齐；正式五秒异常 SLA、长期部署告警及商用许可仍未验收，继续 FIX_VALIDATION。补偿窗口的实际延迟保留，不将成功摄取等同于实时 SLA。
