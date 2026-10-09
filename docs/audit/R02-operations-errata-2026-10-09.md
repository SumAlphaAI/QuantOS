# R02 当前操作说明勘误

日期：2026-10-09。适用于[原操作规程](../runbooks/r02_snapshot_operations.md)与 `crates/quantos-storage/README.md` 的历史文字。当前入口以本勘误和实际Makefile/脚本为准；没有改变命令实现、功能范围或验收标准。


本记录更正 `crates/quantos-storage/README.md` 旧概览中的检查数量和命令含义，当前执行以本勘误、Makefile和实际脚本为准。该README与操作规程原字节属于7f18b8b冻结工程输入，保留用于既有回执溯源；本次用明确勘误更新操作说明，不改写原输入或重签执行事实。

| 旧概览描述 | 当前有效说明 |
|---|---|
| 四类行为变异 | 六类：wire-integrity、strict-rule-floor、duplicate-rules、trusted-clock、source-purpose、approval-reference |
| 五个生产文件覆盖 | 六个：lib/pg/snapshot/supabase_storage/wire/provenance；line≥90%、region≥85%，排除tests |
| r02-live-check默认产生P95基线 | 默认仅功能目标并记录发布性能NOT_RUN；小fixture计时使用显式r02-performance-diagnostic |
| r02-release-performance直接执行SQL并验P95 | 此命令检查Beta移交/正式状态，不执行SQL性能采样、不自行验收whole-Beta；代表性C25执行按发布计划 |

当前DEVELOPMENT已获[用户确认](../gate-records/R02-current-development-confirmation.json)，原正式字段/发布状态保持独立；本轮仅文档与既有证据复核，没有再次连接Supabase或延长行情窗口。当前批准有到期边界，文档中的READY是本次时点结论，后续应执行严格内容/来源批准检查。

原规程“R01尚未纳入通用receipt policy”的陈述已过期。R01/R02已接入，14节点必要闭包当前严格READY；原57/57实际执行仍绑定7f18b8b，当前DEVELOPMENT人工确认已取得。该结论不放行R1总Gate、部署或发布。

原文件受既有工程manifest内容摘要约束。本次将状态与说明修订发布为独立勘误，并由[活跃报告](./R02-comprehensive-review-2026-10-07.md)和开发计划引用；原字节及用户已确认范围保留。后续变更这些受控文件时须按当时内容重新核验准入，不能重写旧执行回执。
