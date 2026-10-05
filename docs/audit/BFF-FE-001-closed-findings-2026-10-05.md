# BFF-FE-001 已关闭问题复核记录（2026-10-05）

复核基线：`f2283fab37386354e19ffe32df2c86a1a7e9676f`，开始时工作区干净，HEAD 与本机 origin/main 引用一致。原 2 个高危、4 个中危均已修复；当前阻塞/高危/中危/低危均为 0。本轮未发现需要追加代码修复的问题。

## 逐项关闭依据

| ID | 模块 | 当前源码与边界 | 验证依据 | 结论 |
|---|---|---|---|---|
| H-01 | live MFA 首因素授权 | settings.rs:868–905 在主体锁内读取当前因素，authorize_enrollment 拒绝有 verified 因素后的旧 first_factor 新注册；完成重放和现有因素恢复仍可用。 | 原双会话实测拒绝新命令、pending 缺因素拒绝、现有因素恢复与取消检查点保护；本轮 live 单元及 first-factor mutation 通过。 | CLOSED |
| H-02 | live 回归保障 | 实际 handler 调用 settings_policy.rs 的 last-factor、CSRF、首因素、TTL 与撤销策略；执行脚本显式运行 --lib，mutation 直接修改这些策略。 | 本轮 5 项 live + 3 项 reference mutation 全由指定业务断言拒绝；14 Rust lib、12 reference、29 consumer 通过。 | CLOSED |
| M-01 | 审计与响应关联 | save_preferences 持久保存私有 correlation 并在 respond 移除私有字段；MFA verify/reauth 及持久撤销事件共用命令 ID。 | 已绑定目标回执验证 5 个响应 → 唯一 audit → 成功 trace、保存重放关联稳定及持久 session_revoked 事件关联。即时权限失效终态事件仍可有独立 ID，不据此声称所有 SSE 事件均来自同一命令。 | CLOSED |
| M-02 | 安全时间来源 | security 读取真实 last_sign_in_at 与持久 mfa.verify.created_at，策略选择最新可信值；无事实时失败关闭，不再倒推 expiry。 | 本轮来源与缺失事实单元通过；目标回执含 MFA 前主认证及 MFA 后持久审计时间断言，OpenAPI/生成物说明一致。 | CLOSED |
| M-03 | 客户端超时与取消 | 统一 transport 默认 30 秒覆盖 headers/body，调用方取消和 bundle 失败中止可用；写结果未知有类型，未自动重试。 | 本轮 29 consumer + 3 transport 通过，覆盖停滞 headers/body、取消、兄弟读取终止、草稿与原 key/版本恢复、SSE 取消。 | CLOSED |
| M-04 | A2 阶段准入 | 内容绑定 manifest 校验当前源码、执行日志、目标断言、恢复与 trace，并递归校验三项前置的当前 READY。 | 本轮实际 A2/PROVIDER:A1 严格门禁 READY；14 项阶段正负、22 项契约负向通过，失效输入/依赖/证据均拒绝。 | CLOSED |

## 本轮执行及既有证据

本轮重新执行 8 项检查命令：local_contract（14 Rust lib、12 reference、29 consumer）、8 项 mutation、A2 严格门禁、14 项阶段正负、22 项契约负向、PROVIDER:A1 严格门禁、计划结构及 3 项 transport 测试，全部通过。F09 目标测试默认 ignored，不计数据库验收。文档整理后再次核验 A2/PROVIDER:A1 与计划结构，并通过 35 项计划负向测试；原始归档一致性和 23 个报告链接检查通过。

已核对目标 receipt 的全部 7 个源码摘要与当前文件一致，并由严格门禁验证原始日志、目标断言、trace 与上游递归证据。本轮没有重新连接 Supabase；实际目标执行仍绑定 `9d67f880fb2b6532114f3f7b7e46ecf952176e1f`：52 次调用覆盖 20 API、14 项强断言及 cleanupVerified=true。不能将这些结果描述为 f2283fa 新执行的目标测试或 hosted CI。

上游 65 项有效结果的来历保持原记录：运行源码上 63 PASS / 2 PRE-04 FAIL，仅修正派生摘要后对全部输入作内容比对，保留 63 项并重跑 2 项。当前 14 节点依赖链及 BFF-FE-001 共 15 节点 READY；独立 F0/G0/FEP-0 的旧准入不迁移。

- [本轮机读复核与命令日志](evidence/bff-fe-001-closure-recheck-20261005/recheck.json)
- [当前内容绑定 A2 manifest](evidence/bff-fe-001-remediation-20261005/final/a2.json)
- [既有目标 receipt](evidence/bff-fe-001-remediation-20261005/live/receipt.json)
- [整改全过程及失败历史](BFF-FE-001-remediation-2026-10-05.md)
- [逐字节保留的初审](BFF-FE-001-findings-archive-2026-10-05.md)

主报告已改为当前结论，移除活动清单中的六项历史发现及已完成的整改待办。初审、原始失败证据、整改台账均保留。DEVELOPMENT READY 不代替 PROVIDER:A2/ALL、G1、staging 或 RELEASE 的独立验收。
