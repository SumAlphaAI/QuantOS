# CORE:R01 Market ingestion 与标准化行情契约交付摘要

更新日期：2026-10-04。状态：FIX_VALIDATION；9 项复审问题关闭，B01 已完成 Binance 原生接入、真实补偿及历史受控异常五秒提交验证，自然运行健康与精确异常提交补证、长期部署、远程同 SHA CI 与许可验收待完成，R01 未 ACCEPTED。

- MarketEvent v2 使用显式标的映射与 BASE/QUOTE；来源身份包含 tenant/provider/ID，并对同 ID 的不同内容报冲突。原始数值错误产生质量事件，坏帧隔离后继续处理。
- `ingest-source` / `poll-source` 将 receipt、序号、事件、审计和 F05 outbox 原子写入配置的 Supabase；重启去重、失败安全重试、F05 inbox/checkpoint、死信重放已有目标 fixture 测试。
- 实际 processing clock 与持久 watchdog 检测积压和断流；历史 replay 明确使用 fixture 时间。稳定及 nightly 覆盖按生产文件单独检查，门槛为 line ≥90%、region ≥85%、branch ≥85%。
- Replay 限 100,000 条、frame 限 16KiB，非法 spec 返回错误；本地领域/CLI 测试与真实编译 mutation Gate 阻止回归。

完整修复状态、计数、覆盖及 Supabase 回执见 [整改验证报告](./audit/R01-remediation-validation-2026-10-02.md)。[全面复审报告](./audit/R01-comprehensive-review-2026-10-02.md)保留修复前历史结论。

使用 [摄取 Runbook](./runbooks/r01_market_ingestion.md)配置必要 trace sink、有效 tenant/actor、受控审批文件；Binance 原生 REST 使用下方专门 Runbook。[provider 获取与审批指南](./runbooks/r01_provider_onboarding.md)说明官方渠道及内部申请流程。公共入口可访问不能代替使用许可；JSONL `poll-source` 仍需标准化 adapter。

本地领域、Supabase fixture、Binance 真实源、CI 工作流与正式供应商验收分别记录。部署端告警与远程同 SHA CI 验收尚未执行。原 session pool 饱和仍保留为历史环境故障；本轮显式使用同一 Supabase 项目的事务池，保留八独立连接并发与旧断言，完整目标 Gate 的最终结果见[持续运行验证报告](./audit/R01-supervision-validation-2026-10-03.md)。不能由此宣布整个 R1 服务验收完成。

## 2026-10-03 Binance 接入补充

用户决定先采用无需 Key 的 Binance 公共现货聚合成交。新增 `binance-rest` 原生 REST 命令、Supabase 原子页/持久游标、独立 transport watchdog 和受控授权记录。真实 BTCUSDT/ETHUSDT 摄取、停止/重启补偿、连续 ID/readback、重复与 F05 交付已有回执；详见 [接入验证报告](./audit/R01-binance-rest-validation-2026-10-03.md)。

B01 的 native adapter/真实来源执行缺口已补齐；正式五秒异常 SLA、长期部署告警及商用许可仍未验收，继续 FIX_VALIDATION。补偿窗口的实际延迟保留，不将成功摄取等同于实时 SLA。

## 持续运行与异常验证

新增独立监督进程，持久游标接续、正常轮换、限流退避、人工处理退出码 78、审批撤销停止、独立监控/告警、健康文件和日志轮转均已实现。Supabase fixture 12/12、真实 Binance 进程故障 3/3 通过，异常发生至目标提交 ACK 最大分别 2164ms、1919ms，事件读回与 F05 checkpoint 对齐。完整 Gate/覆盖、历史失败、证据哈希及剩余边界见[本轮报告](./audit/R01-supervision-validation-2026-10-03.md)；部署步骤见[监督 Runbook](./runbooks/r01_binance_supervisor.md)。

## 30 分钟扩大窗口

2026-10-04 用户选择 30 分钟内部 BTCUSDT/ETHUSDT 评估，新增严格 v2 授权与单独范围，不延长原到期日。实际 1801.473s、115 样本，6243 个唯一成交；两个 ID 区间、正常轮换、11195 条 F05 交付/checkpoint、actor 停用通过。但 readiness 仅 30.43% 采样正常，2623 个 tick 新鲜度降级，完整性 PASS 不等于全程健康。详见[扩大窗口报告](./audit/R01-window-validation-2026-10-04.md)。R01/B01 仍为 FIX_VALIDATION / PARTIAL；24h、部署、商用许可与远程 CI 未验收。

## 新鲜度专项评估

既有事实只读复核：source-age P95 3686.049ms，响应到检测 P95 17.437ms；检测时 2623/6243（42.02%）tick 已超 2s。剔除启动前样本后 ready=35/114（30.70% 点样本，不是 uptime）。同一 BTC 页 44 个自然 tick 告警的检测到 progress 观测 >5s，实际 ACK 尚缺精确测量；native source 告警有 1157 个无 ACK 回执，trace 有 3 坏行。完整度、delivery 和 processing 短时长都不能覆盖这些健康/测量缺口。详见[专项评估报告](./audit/R01-freshness-assessment-2026-10-04.md)。

本次没有新摄取或数据库写入，actor 仍 inactive，历史事实保留。scope 固定 1800 秒、两标的、原内部用途及 2026-10-10T00:00:00Z 到期日；后续复跑采用有效批准、新具名 actor、新空证据目录，失败保留并停止进程/停用 actor。24h 或部署需新范围授权；Linux/systemd、父启动器/主机死亡通知、商用许可、远程同 SHA CI 仍待验收，B01 OPEN/PARTIAL。
