# R01 持续运行验证证据

日期：2026-10-03；基线 c676d29c91f50b8ef96ddf6d2dc8913be4eb97f1。所有真实数据库操作使用同一已配置 Supabase，不创建本地数据库。

最终验收：final-stable、final-nightly 是保留旧八并发用例的完整目标 Gate 和 Rust 覆盖；final-fixture-v2 是原生监督 fixture 12 项；final-live 是真实 Binance 原生进程故障/恢复 3 项。报告见 ../../R01-supervision-validation-2026-10-03.md。各回执的 sourceHashes 是测试时源码，workingTreeModified=true；index 的 sourceHashes 绑定最终交付文件，不伪造提交后的远程同 SHA 回执。

过程证据：pool-probe 为饱和 session 池拒绝，transaction-pool-probe 为同项目事务池八连接。full-gate-initial 完成目标用例后因源码漂移失败。fixture-initial 是 SQL 读回列错误；fixture-diagnostic、fixture-pre-final、verified-fixture 是早前快照成功，已被最终结果取代。final-fixture 的监控读超时失败、live-diagnostic 的停机失败均保留。Gitleaks 初始发现公共 digest 误报，findings 仅保存位置/fingerprint；精确忽略后历史 Gate 重跑，无凭据进入证据。

所有覆盖原始 JSON 以 gzip 无损保存，解压后可重跑 check-r01-coverage.mjs；coverage-summary.json 是原阈值 Gate 输出。index.sha256 校验此目录全部文件（index 自身除外）。运行时日志、受控故障时间和异常 event readback 必须联合判读，不能将 fixture 标为真实 Binance。24h、Linux 部署、监督/主机死亡外部通知、商用许可、远程 CI 均未验收。
