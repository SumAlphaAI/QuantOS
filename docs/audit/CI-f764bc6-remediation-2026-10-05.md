# f764bc6 CI 故障整改记录（2026-10-05）

当前状态：代码修复已完成聚焦验证，冻结源码后的实际目标测试及内容绑定工程证据正在复验；本文将随最终证据更新。没有重置/重建目标 Supabase。

| 失败工作流 | 原因 | 修复 |
|---|---|---|
| QuantOS CI | 历史扫描 5 条 generic-api-key 匹配，均为已核实文件/契约摘要；F02 artifact 与下载错误为前置失败的连带结果 | 仅允许 3 个逐字节核实的确切 SHA-256 值；扫描范围保留完整 Git 历史 |
| Frontend Baseline | A1 manifest 引用的 F04 coverage 被通用 artifacts/ 忽略，干净检出 ENOENT | 补入原文件并保留原哈希；后续 assessor 保存到 supporting/，避免再次漏交 |
| F01 Clean Room | Webpack 实际配置的 resolve.extensionAlias 访问到了缺少 resolve 的测试夹具 | 编译夹具提供 resolve={}，仍验证真实可执行字节及真实碰撞拒绝 |
| F09 Observability | logout/trace 组件测试要求未配置的 QUANTOS_BFF_DATABASE_URL；失败前已写入本轮 session | logout-only 夹具使用现有连接及显式 CA/verify-full，以 cfg(test) 适配器构造未使用的 A2 状态；生产窄登录入口不变；配置完成后才创建测试 session |
| R01 Market nightly | native watchdog 先插入共享幂等异常事件，supervisor 收到 duplicate；测试只等待 supervisor 的 ACK，误判超时 | 消费持久 commit-evidence 和两种 producer 的 confirmed insertion，去重；保留 event_id 目标读回及 5 秒上限，不延长时限或重试不确定写 |

聚焦检查已通过：Webpack 5、R01 producer 回归 3、provider receipt 反证、G0/FEP0 聚合 81、fmt、PRE-04 及全历史 secret scan。各失败原始日志、redacted 匹配及 R01 实际 native ACK 在 [证据目录](evidence/ci-f764bc6-remediation-20261005/) 保留。

CI 还消费 F0/G0/FEP0 工程回执，本轮脚本/测试输入改变后需重新评估当前工程范围；原始用户确认和旧工程快照已经保存。技术复验不代签新范围确认，G0/FEP0 可以工程 PASS 而准入 BLOCKED。BFF-FE-001 六项历史问题的关闭事实保留，当前功能准入将在同一冻结源码复验后刷新。

补充实测：R01 按 GitHub transaction pool 设置 16/16 PASS，最大异常确认 3285ms；原 nightly native ACK 经当前 normalizer 和 Supabase 读回确认（2034ms）。两轮默认 session pool 失败单独保留。旧 A1 的 69 个引用文件均已被 Git 跟踪，F04 原 coverage 的 Git 快照/摘要/覆盖率校验通过。

首轮完整评估保留 8 个已执行结果，其中 F09 因 raw operator TLS 模式失败；停止后对夹具的 TLS、CA、窄登录和 SET ROLE 候选逐项实测，失败证据保留。最终 test-only 适配器不执行设置 API 或权限验收，也不改变数据库角色。格式化后的源码需完整重新评估。

2026-10-06：最终 F09 无窄 URL 实测通过。正常 A2 在 fab00ba 第三轮 51 次调用、20 API、14 强断言及 cleanupVerified=true；前两轮在首次材料交付处 503/恢复 restart_required 而终止，恢复均通过。直接 Auth 响应头诊断与隔离诊断二进制不计验收。新目标证据独立存入 ci-live-20261006，recorder 可显式选择该受限目录，原 live 回执不覆盖；完整上游需在最终 recorder 源码冻结后重新执行。
