# R03 本地开发 Gate 与 Supabase 发布验收分离

**R03 DEVELOPMENT READY（R03_LOCAL），engineering PASS，formalAccepted=false。** 冻结源码`b2511e1d63508c61be5f304f0f0c02ec5001faae`实际完成49组本地前置、15节点功能投影与R03七组回归；全图1 READY、158 NOT_ASSESSED、0 BLOCKED。Supabase验收NOT RUN、RELEASE-GATE:BETA仍NOT_ASSESSED。原5d35c91d只读检查点、失败回执与历史退役pending=0保留；本轮未连接数据库，不宣称恢复可写性或实时pending状态。

[用户原始指令](./evidence/r03-local-gate-policy-20261011/policy-user-direction.json)只修改R03开发Gate。实现R03_LOCAL功能投影：重新执行R02/TP02必要15节点闭包中全部非Supabase命令，并补充F07 Runtime/gateway本地功能；每项绑定当前源码、规范要求、命令、时间、日志/制品hash与依赖。另执行R03七组回归及专属Engine清理。仅R03可消费LOCAL_READY；其他任务仍使用严格原回执，不将F07/R02/F0整体或数据库目标标成READY。

| 开发阶段仍必须通过 | 最终上线前必须实际验收 |
|---|---|
| 10次固定输入hash与证据定位、取消≤2秒 | 开发/发布目标Supabase容量、默认可写性与服务健康 |
| 恢复、幂等、无重复Artifact/成本逻辑 | PostgreSQL真实事务/迁移/RLS、私有Storage字节与权限 |
| tenant/actor/capability、deadline/预算拒绝 | Auth/BFF/Runtime完整持久链及真实强杀100任务恢复 |
| 快照hash/血缘/质量/来源许可拒绝、锁文件/供应链检查 | 获准来源的R02持久消费、代表性P95/长稳/清理 |
| Runtime→Manager→独立Python Engine及隔离wheel功能 | 候选同SHA CI、发布授权及适用正式用户确认 |

原目标命令全部按策略列为NOT_RUN→RELEASE-GATE:BETA；未删除、未标PASS，指标阈值保持。旧Supabase生命周期是历史证据，不能因新源码/新规则继承为发布证据。`make r03-release-check`缺少新目标、严格前置或正式Beta验收时拒绝；发布scope必须保留全部移交。

没有本地PostgreSQL/Supabase容器；不连接开发数据库、不产生新数据库fixture、不消费目标库32条真实事实、不扩展用途/到期时间、不调用生产凭据或外部发布。仅用自有合成输入；原限时复验范围仍于北京时间10月14日08:00到期。Supabase数据库验收仍为NOT RUN。

历史：[原R03 manifest](./evidence/r03-local-gate-policy-20261011/history/r03-supabase-prerequisite-manifest.json)、[旧确认稿](./evidence/r03-local-gate-policy-20261011/history/r03-prior-confirmation-draft.md)、[容量与退役](./R03-supabase-recovery-2026-10-11.md)。本轮工程人工确认不由修改Gate指令推定。

## 初轮与修正

冻结2962c53e的首轮49组中，27 PASS、1 FAIL、1 INTERRUPTED、20 NOT RUN；R03七组尚未开始，不发布READY。新增gateway命令误用不存在的`--lib`目标，实际返回101。修正为`--bin runtime-gateway`并显式过滤两项真实数据库用例，定向8 PASS；新增Cargo metadata目标存在性检查，门禁124 PASS。失败不是Supabase指标，也未豁免。

[首轮逐项处置](./evidence/provider-a1-remediation-20261004/r03-local-development-20261011/attempt-01/disposition.json)、[中断与原因](./evidence/provider-a1-remediation-20261004/r03-local-development-20261011/attempt-01/interrupted.json)、[专属Engine清理PASS](./evidence/provider-a1-remediation-20261004/r03-local-development-20261011/attempt-01/interrupted-process-cleanup.json)、[修正验证](./evidence/r03-local-gate-policy-20261011/gateway-target-fix.log)保留。后续从新干净提交完整复验，不拼装旧源码结果。

## 当前执行与证据

第二轮从干净提交完整执行，全部结果来自新源码，没有拼装首轮结果。源代码/规范/命令、日志hash、制品hash及递归依赖均由校验器实际检查。

| 命令/检查 | 实际结果 |
|---|---|
| `node scripts/r03-record-development.mjs docs/audit/evidence/provider-a1-remediation-20261004/r03-local-development-20261011/attempt-02` | exit0；49/49前置PASS，15/15 LOCAL_READY，R03 7/7 PASS，专属Engine清理PASS |
| 三轮独立构建 | 全部PASS、产物摘要相同；source.dirty=false |
| 前置全量 lint/test、覆盖、治理 | 全部PASS；Python1366 PASS；gateway本地8 PASS、两项数据库用例显式过滤 |
| R03七组 | Runtime19、Storage22、编排2+3、TP02 131、Manager55；clippy/计划/34门禁测试PASS |
| `node --test scripts/provider-a1-receipts.test.mjs scripts/r03-stage-check.test.mjs scripts/development-plan-order-negative.mjs` | 124/124 PASS，0失败/跳过；含Cargo目标存在性、日志/源代码/依赖/发布移交篡改拒绝 |
| `node scripts/r03-stage-check.mjs --verify`、`make r03-admission-check` | 均exit0；R03_LOCAL READY，databaseAcceptance=NOT_RUN |
| `make r03-release-check` | 预期exit2：缺少新Supabase目标证据时拒绝；不是发布通过 |
| 五个上游严格Gate拒绝探针 | 全部REJECTED；本地投影没有重授其数据库/全范围READY |
| `node scripts/check-development-plans.mjs` | PASS；1 READY / 158 NOT_ASSESSED / 0 BLOCKED |

当前[manifest](./evidence/r03-20261011/manifest.json)摘要`sha256:05c684e1953bf8e696d2c8679c1c13b3f0d609490203b3d095140ce4ec05fe7c`，绑定97功能输入；[49组完整台账](./evidence/provider-a1-remediation-20261004/r03-local-development-20261011/attempt-02/execution-results.json)、[15节点投影与13组移交](./evidence/provider-a1-remediation-20261004/r03-local-development-20261011/attempt-02/local-prerequisites.json)、[R03七组](./evidence/provider-a1-remediation-20261004/r03-local-development-20261011/attempt-02/r03-execution-results.json)、[实际最终门禁与拒绝探针](./evidence/r03-local-gate-policy-20261011/final-checks.json)。

## 变更与未决事项

核心变更是`provider-a1-receipts`的R03限定投影、`r03-record-development`实际收集器、R03 v2 admission/独立release检查、计划顺序限定例外、策略与负向测试。两份计划、执行说明、确认稿和历史索引同步更新。[完整变更文件清单](./evidence/r03-local-gate-policy-20261011/changed-files.txt)包含代码、文档、回执、日志及wheel制品。

- 最终发布前必须逐项实际执行13组Supabase前置及R03真实持久生命周期，解决上次目标容量/默认只读问题，复验迁移/RLS/Auth/Storage、强杀恢复/取消/无重复费用、清理、代表性P95与长稳。原性能失败不能因延期标PASS；本地Gate不修改阈值。
- 新候选同SHA hosted CI、部署/发布授权、适用用途许可及正式用户确认未执行。本轮无生产凭据、付费升级、外部发布或Git推送。
- R02保留事实许可只限原32条内部复验，至北京时间10月14日08:00；本轮不消费该目标数据，也不续签/扩大采集、交易、展示、再分发或商用范围。
- 无长任务lease heartbeat、真实模型token/金额预算与真实模型质量验收，仍按原R03工程边界处理。
- [新工程确认文稿](../gate-records/R03-development-user-confirmation-draft-2026-10-11.md)为PENDING_USER_CONFIRMATION。流程调整指令不是该文稿的确认，不自行批准。

下一可执行任务是R04接口/fixture与当前前置预检；完整准入需另行复评TP03、TP04和F0。当前调整仅授予R03本地Gate，不自动放行R04或R1总Gate。当前报告/执行说明/确认稿的本地链接与确认摘要校验PASS；本轮变更源码及实际日志约4.46MB秘密扫描exit0，无泄漏发现。

源码提交为2962c53e（策略）和b2511e1d（gateway修正及首轮证据）；本轮最终文档/证据提交以Git历史和交付报告为准。
