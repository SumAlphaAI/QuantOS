# R01 30 分钟扩大窗口证据

本轮授权为 2026-10-04 用户选择的 30 分钟内部 BTCUSDT/ETHUSDT 评估。仅连接原配置 Supabase，使用官方 Binance 公共 REST，不创建本地数据库。

每个 attempt 为独立窗口：config、owned-scope、原生 trace、supervisor 日志、15 秒 samples 和 receipt/failure 联合读取。failure 必须保留；多个短跑不合并成 30 分钟通过。samples 的健康/新鲜度、CPU/RSS 和事件计数是采样观测，不是宿主机或商用部署验收；采样间隔有实际数据库耗时，不伪造固定 15 秒节拍。

PASS 需完整单窗口 ≥1800 秒、两个独立 ID 区间完整、正常 worker 轮换、F05 pending=0/outbox=applied/checkpoint 对齐及 actor 停用读回。最终 attempt-01/receipt.json 为 PASS：1801473ms、115 样本、6243 唯一成交、outbox/applied 11195/11195、pending=0、actor inactive。readiness 35/115（30.43%）且 2623 个 tick freshness 降级，不声明全程健康。原始 samples/trace/supervisor JSONL 已先执行 Gitleaks 扫描，再无损 gzip；解压后按 compression-manifest 校验原始字节与 hash。基线提交保留为回执 sourceCommit，workingTreeModified=true；新增提交只核对相同文件 blob，不伪造测试已经在提交后执行。

历史 2026-10-03 的完整 Gate/五秒故障验收见 ../r01-supervision-20261003/，本轮不会修改历史结论。24h、外部父进程/主机死亡通知、Linux 部署、远程 CI、商业许可均未验收。
