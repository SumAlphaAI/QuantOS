# CORE:R02 DataSnapshot、血缘与质量 Gate

2026-10-08 当前交付：只读且自校验的 DataSnapshot/v1、canonical hash/微秒时间规范化、source-age 与交易硬底线、租户引用校验、具名 actor 的原子写审计、成员受限读取 API、对象 durable intent/显式恢复、CommandMetadata/wire 桥接及行为/目标覆盖 Gate。新增服务器来源批准/实际 market 血缘校验、冷读持久化消费者与完整 wire 可信引用解析。当前整改见[续修报告](../audit/R02-partial-remediation-2026-10-08.md)，原13项整改见[逐项报告](../audit/R02-remediation-2026-10-07.md)，基线问题与失败证据见[全面复审](../audit/R02-comprehensive-review-2026-10-07.md)。

`make QUANTOS_SKIP_ENV=1 r02-check` 为无数据库功能检查；`make r02-live-check` / `make r02-target-coverage` 连接配置 Supabase，必须使用空的新证据目录并确认具名 actor 停用/本轮边界对象清理。`make r02-chain-check` 复用获准保留事实、保留本轮证据对象并停用 actor；不启动行情。禁止建立本地 PostgreSQL/Supabase 或临时容器数据库。操作与恢复见[规程](../runbooks/r02_snapshot_operations.md)。

工程修复验证不自动产生 READY/ACCEPTED。获准保留事实到持久化快照/当前规则到实际 Research Engine 的开发链可运行；历史行情 Degraded 且只准内部 Research，策略/交易拒绝。R01实时健康与正式依赖准入仍独立追踪。部署 HTTP/BFF/JWT、代表性容量/P95与候选同 SHA远程CI移交 RELEASE-GATE:BETA；未部署不阻塞组件功能。开发默认不执行发布时延采样，原超标基线保留。

2026-09-16 的未连接目标数据库/Storage 结论仅属于[历史验收证据](../audit/R02-acceptance-evidence-2026-09-16.md)；该记录与当时 SHA 保留，不代表 2026-10-07 的执行结果。
