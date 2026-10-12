# TP03 / TP04 / F0 本地开发 Gate 与后续阶段移交

范围依据：用户在本会话明确授权新增 TP03、TP04、F0 本地开发 Gate、Supabase目标最终发布验收，并检查 R04 后全部任务。此授权不是正式工程接受或发布授权。

本轮实现 `R04_LOCAL`：17个必要前置节点、56组本地检查；原13组Supabase目标命令完整移交 `RELEASE-GATE:BETA`，保持 NOT_RUN。仅 F0、TP03、TP04 发布自身本地Gate，其他上游记录不授予目标READY；R03另复验自身7组检查。R04 admission是实施准入，R04完成Gate仍NOT_ASSESSED。

## 执行与验收边界

- 冻结源码提交后运行 `make r04-assess-local`；本地前置与R03必须来自同一候选提交，日志、Artifact、wheel、源码/计划内容和依赖摘要递归绑定。
- `make f0-local-check tp03-local-check tp04-local-check r03-admission-check r04-admission-check` 验证当前本地准入；`make local-release-check` 无最终目标与正式Beta回执时明确拒绝。
- 严格入口 `node scripts/provider-a1-receipts.mjs --f0` 与组件 `--ready` 保留原数据库消费要求，不将本地档案作为严格数据库通过回执。
- 读取数据库变量和目标 opt-in 从本地环境剥离；不加载 `.env.local`，不创建本地数据库，不连接Supabase，不升级订阅，不使用生产凭据或外部发布。

## 后续任务完整性

核心计划R04之后22个任务逐卡定义本地开发、INTEGRATION测试及最终发布范围。原量化/集成要求保留，外部环境和代表性性能不阻塞DEVELOPMENT。`scripts/development-gate-handoff-policy.json`与任务卡逐字绑定，`make development-handoff-check`和计划CLI校验覆盖缺项、漂移和假PASS。真实模块集成仍属测试；截止时间、拒绝、幂等/恢复等正确性不能后置。

## 原失败证据与活动问题

[原目标诊断与严格失败报告](./F0-target-failures-remediation-2026-10-12.md)、[原56组结果](./evidence/provider-a1-remediation-20261004/f0-target-readmission-20261012/attempt-01/execution-results.json)、[原完整性索引](./evidence/f0-target-diagnostics-20261012/integrity.json)保留。新runner在写组件回执前逐字归档TP03/TP04/R03旧证据并绑定SHA，失败尝试不拼接为新PASS。

R04-P03公共Rust校验器接受7/9畸形输入、R04-P04研究输入消费闭环及专用完成回执仍待实现，详见[原R04预检](./R04-interface-fixture-preflight-2026-10-12.md)。这些阻塞R04完成验收，不阻塞开展修复实现。Supabase只读、真实Auth/持久恢复、性能/长稳、hosted CI及正式用户确认均不因本地准入完成。

## 实际复验

待从冻结提交执行后补充实际结果。未执行项不记PASS。
