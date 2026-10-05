# f764bc6 CI 故障整改记录（2026-10-05）

当前状态：代码修复已完成聚焦验证，冻结源码后的实际目标测试及内容绑定工程证据正在复验；本文将随最终证据更新。没有重置/重建目标 Supabase。

| 失败工作流 | 原因 | 修复 |
|---|---|---|
| QuantOS CI | 历史扫描 5 条 generic-api-key 匹配，均为已核实文件/契约摘要；F02 artifact 与下载错误为前置失败的连带结果 | 仅允许 3 个逐字节核实的确切 SHA-256 值；扫描范围保留完整 Git 历史 |
| Frontend Baseline | A1 manifest 引用的 F04 coverage 被通用 artifacts/ 忽略，干净检出 ENOENT | 补入原文件并保留原哈希；后续 assessor 保存到 supporting/，避免再次漏交 |
| F01 Clean Room | Webpack 实际配置的 resolve.extensionAlias 访问到了缺少 resolve 的测试夹具 | 编译夹具提供 resolve={}，仍验证真实可执行字节及真实碰撞拒绝 |
| F09 Observability | logout/trace 组件测试要求未配置的 QUANTOS_BFF_DATABASE_URL；失败前已写入本轮 session | 测试状态与 middleware 使用既有 DATABASE_URL；生产窄角色入口不变；实际目标复验验证 logout 删除 session 与 trace |
| R01 Market nightly | native watchdog 先插入共享幂等异常事件，supervisor 收到 duplicate；测试只等待 supervisor 的 ACK，误判超时 | 消费持久 commit-evidence 和两种 producer 的 confirmed insertion，去重；保留 event_id 目标读回及 5 秒上限，不延长时限或重试不确定写 |

聚焦检查已通过：Webpack 5、R01 producer 回归 3、provider receipt 反证、G0/FEP0 聚合 81、fmt、PRE-04 及全历史 secret scan。各失败原始日志、redacted 匹配及 R01 实际 native ACK 在 [证据目录](evidence/ci-f764bc6-remediation-20261005/) 保留。

CI 还消费 F0/G0/FEP0 工程回执，本轮脚本/测试输入改变后需重新评估当前工程范围；原始用户确认和旧工程快照已经保存。技术复验不代签新范围确认，G0/FEP0 可以工程 PASS 而准入 BLOCKED。BFF-FE-001 六项历史问题的关闭事实保留，当前功能准入将在同一冻结源码复验后刷新。
