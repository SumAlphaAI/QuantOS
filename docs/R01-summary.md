# CORE:R01 Market ingestion 与标准化行情契约交付摘要

> 日期：2026-09-16
> 状态：仓库来源层完成；GPT-6 Astra、真实 provider、消息基础设施与目标环境未验收

## 交付结果

- `quantos-market` 冻结批准 provider registry、原始 tick、标准化 `MarketEvent`、质量状态和异常事件契约。
- symbol 只接受 ASCII 字母数字及 `/`、`-`、`_` 分隔形式；意外标点 fail closed。价格与数量保留 decimal 精度，非正值产生 quality failure。
- provider/source tick ID 去重只在 tick 完成结构与数值校验后提交，避免错误数据污染后续更正。
- 10 万条确定性 replay fixture 覆盖乱序、重复、陈旧与质量失败；同步 ingestion 在五秒边界内生成 freshness/quality anomaly，并写入 `quantos-event` append-only ledger。
- `market-ingestor` 提供 replay generate/ingest CLI，并接入统一 observability command wrapper。
- `make r01-check` 将源码契约、9 项 Gate/负向测试和 Rust replay 测试接入主 CI。

验收命令与边界见 [R01 验收证据](./audit/R01-acceptance-evidence-2026-09-16.md)。
