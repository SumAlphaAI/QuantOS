# TP01-F_LOCAL 本地开发准入

消费者为 CORE:TP01-F，必要闭包为 TP01-E 的 28 节点加 TP01-F，共 29 节点。所有本地必要命令必须在干净冻结候选完整实际执行；Supabase、外部目标和性能移交测试/RELEASE-GATE:BETA。不得将合成 7 天指标或 240 秒字段当作真实窗口与目标回滚回执。

`vibe_adapter.rollout.RolloutController` 使用由宿主提供的独立 authority key，校验 HMAC-SHA256、release ID、实际 catalog 字节和 policy digest。先验证候选与 previous 的完整字节，再一次切换；解析为不可变 QuantOS ResearchExecutionContract，只允许 TEST/RESEARCH。本地演练使用代码公开的 fixture authority，不属于生产签名或用途批准。服务默认拒绝 Execute/StreamExecute，health/metadata 继续可用；`--fixture-routing` 明确启用原 unsigned 合成契约模式，不可用于发布。

canary 使用宿主策略的 5% 稳定身份摘要分流。影子服务由宿主设置 shadow_mode，独立 mock Artifact facade 和 bucket；请求负载不能切换 flag、release、authority 或 shadow。运行中 disable/rollback 与 Artifact commit 共享锁；动作先发生时，旧 epoch 的 unary/stream 请求返回 CANCELLED/ENGINE_ROLLOUT_REVOKED，不再写 Artifact；提交先完成时，已提交结果有效，stream 可确定性完成。再次激活不能使旧 epoch 工作获得新权限。rollback 使用事先验签并固定到内存的 previous provider，后续请求实际消费其字节，重复 rollback 保持同一制品。保留动作/签名拒绝/请求摘要/提交/告警的连续事件；任意 reason 只保留 digest。

本地观测接收宿主的完整有限数值样本；阈值采用 canary-policy.json。critical 立即禁用，shadowMismatchRate 的 warning 记录并保持观测。样本反映本地机制测试，不声称代表性 P95 或正式安全隔离。dashboard/alert rules 是待部署配置；本地只校验配置与规则触发，不宣称已导出目标监控指标。控制器、mock Artifact 和审计仅在本机进程内，持久化、跨进程恢复、正式 authority/业务控制权限及目标监测由发布验收。

`python -m vibe_adapter.local_drill` 实际启动两个本机 UDS 服务，执行 19 条独立演练，保存签名 descriptor、候选/previous catalog 原件、drill.json 和 runtime-events.json。`scripts/tp01-f-functional.mjs --record` 另执行 47 项 Python 回归、15 项策略模拟回归与三组原 CLI，生成 quantos-tp01-f-functional/v1。此功能生产者只输出 stageGate=NOT_ASSESSED、formalAccepted=false、targetCanaryAccepted=false、targetRollbackAccepted=false；支持文件复制后必须按原件完整校验，不允许 canonical fallback。

干净冻结后运行 `node scripts/record-tp01-f-local.mjs [fresh-attempt]`；attempt 须位于 docs/audit/evidence/provider-a1-remediation-20261004/tp01-f-local-YYYYMMDD/attempt-NN。运行器逐项执行完整闭包，保存生成与原 canonical 原件，失败同样恢复。共同执行可派生同候选 E 的 28 节点回执，限定恢复 E 本地 Gate；不能拼接旧 SHA 结果。E 新回执放在 tp01-e-readmission-20261014，旧 tp01-e-local-20261014 原件保留。F 专用准入只放行 F；发布任一步失败恢复 E/F manifest 和两计划字段。

`make tp01-f-local-check` 校验真实 index；`make tp01-f-release-check` 在目标与正式确认不足时拒绝。7 天无未解释 P1、目标回滚≤5分钟、Supabase/外部目标/正式签名/持久恢复/性能与同 SHA 远程 CI 保持 NOT_RUN。不使用生产凭据，不派发 workflow、不发布 issue/PR、不 push、不部署。

下一可执行任务是 TP01-G 本地协议隔离/模块替换回归和原生替换计划；上游贡献只形成可审阅 patch/说明，外部 PR 提交需另行授权。SERVICE:TP01 全量服务准入仍须独立完整校验。
