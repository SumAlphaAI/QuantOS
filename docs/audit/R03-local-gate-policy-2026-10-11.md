# R03 本地开发 Gate 与 Supabase 发布验收分离

**按项目用户指令调整R03范围；新范围待实际复验，当前NOT_ASSESSED。** 这不是恢复Supabase可写性或付费升级。原5d35c91d检查点、失败回执与已退役pending=0保留；数据用途/正式确认/CI/发布权限独立。

[用户原始指令](./evidence/r03-local-gate-policy-20261011/policy-user-direction.json)只修改R03开发Gate。实现R03_LOCAL功能投影：重新执行R02/TP02必要15节点闭包中全部非Supabase命令，并补充F07 Runtime/gateway本地功能；每项绑定当前源码、规范要求、命令、时间、日志/制品hash与依赖。另执行R03七组回归及专属Engine清理。仅R03可消费LOCAL_READY；其他任务仍使用严格原回执，不将F07/R02/F0整体或数据库目标标成READY。

| 开发阶段仍必须通过 | 最终上线前必须实际验收 |
|---|---|
| 10次固定输入hash与证据定位、取消≤2秒 | 开发/发布目标Supabase容量、默认可写性与服务健康 |
| 恢复、幂等、无重复Artifact/成本逻辑 | PostgreSQL真实事务/迁移/RLS、私有Storage字节与权限 |
| tenant/actor/capability、deadline/预算拒绝 | Auth/BFF/Runtime完整持久链及真实强杀100任务恢复 |
| 快照hash/血缘/质量/来源许可拒绝、锁文件/供应链检查 | 获准来源的R02持久消费、代表性P95/长稳/清理 |
| Runtime→Manager→独立Python Engine及隔离wheel功能 | 候选同SHA CI、发布授权及适用正式用户确认 |

原目标命令全部按策略列为NOT_RUN→RELEASE-GATE:BETA；未删除、未标PASS，指标阈值保持。旧Supabase生命周期是历史证据，不能因新源码/新规则继承为发布证据。`make r03-release-check`缺少新目标、严格前置或正式Beta验收时拒绝；发布scope必须保留全部移交。

没有本地PostgreSQL/Supabase容器；不连接只读开发库、不产生新fixture、不读取32条真实事实、不扩展用途/到期时间、不调用生产凭据或外部发布。仅用自有合成输入；原限时复验范围仍于北京时间10月14日08:00到期。Supabase数据库验收仍为NOT RUN。

历史：[原R03 manifest](./evidence/r03-local-gate-policy-20261011/history/r03-supabase-prerequisite-manifest.json)、[旧确认稿](./evidence/r03-local-gate-policy-20261011/history/r03-prior-confirmation-draft.md)、[容量与退役](./R03-supabase-recovery-2026-10-11.md)。本轮工程人工确认不由修改Gate指令推定。

## 初轮与修正

冻结2962c53e的首轮49组中，27 PASS、1 FAIL、1 INTERRUPTED、20 NOT RUN；R03七组尚未开始，不发布READY。新增gateway命令误用不存在的`--lib`目标，实际返回101。修正为`--bin runtime-gateway`并显式过滤两项真实数据库用例，定向8 PASS；新增Cargo metadata目标存在性检查，门禁124 PASS。失败不是Supabase指标，也未豁免。

[首轮逐项处置](./evidence/provider-a1-remediation-20261004/r03-local-development-20261011/attempt-01/disposition.json)、[中断与原因](./evidence/provider-a1-remediation-20261004/r03-local-development-20261011/attempt-01/interrupted.json)、[专属Engine清理PASS](./evidence/provider-a1-remediation-20261004/r03-local-development-20261011/attempt-01/interrupted-process-cleanup.json)、[修正验证](./evidence/r03-local-gate-policy-20261011/gateway-target-fix.log)保留。后续从新干净提交完整复验，不拼装旧源码结果。
