# BFF-FE-001 复审证据（2026-10-05）

主报告：[`BFF-FE-001-comprehensive-review-2026-10-05.md`](../../BFF-FE-001-comprehensive-review-2026-10-05.md)。

源码为 `de74b112dab8e4ec5141142cdced75f59b58626c`；受检文件摘要见 `source-inputs.json`，逐项统计见 `inspection.json`，实际命令/退出码及日志摘要见 `commands.json`。`manifest.json` 汇总证据文件摘要并绑定主报告。添加报告前工作区干净；目标回执因新增审计文件记为 sourceTreeClean=false，不是干净发布候选验收。

本轮 pnpm 检查使用已有缓存中的 10.20.0，Node 24.12.0。初始系统 pnpm 11 的中断日志保留；回环端口权限失败与外联失败保留在首次日志及 `live-network-failed/receipt.json`。后续完整执行成功的日志另存，不覆盖失败事实。

## 核心产物

- `live/receipt.json`：现有 Supabase Auth/PostgreSQL + 本机 live BFF，20 operation / 50 helper 请求记录；观察字段复现授权、correlation 与安全时间问题。runner PASS 仅表示原回归/探针/清理执行成功，不表示这些问题已关闭。
- `live-input-negative/receipt.json`：4 helper 请求及 2 直接 HTTP 请求，验证资料只读字段和错误类型均被拒绝；不是身份字段注入漏洞。
- `live-review.mjs` / `live-profile-review.mjs`：实际执行的两份目标 runner。前者从工程现有脚本增加探针，后者聚焦输入负向；使用原环境变量名，不保存凭据或 enrollment URI。`test-authorization.json`记录用户本轮测试授权，**不是验收批准**。
- `reference-profile-probe.mjs/.json`：本机 reference 内存负向，候选身份覆盖问题被反证。
- `live-last-factor-mutant.json/.log`：在隔离临时源码中删除实际 live 最后因素保护，编译成功但 reference 语义套件仍 12/12 PASS；源码副本已删除，仓库实现未改变。
- `dependency-stage-probe.mjs/.json`：仅修改内存 validator 输入，上游阶段重置后 local_contract PASS；这个 Gate 不能当阶段 READY runner。
- `semantics*`、`mutation-*`、`reference-http.json`、coverage summary：从本轮实际工具产物归档；原 reference mutation 的 3 项拒绝与新增 live mutation 漏检分别保留。

## 重放边界

在同一受检源码和工程已有依赖下，可按 `commands.json`重放无 DB 检查。`reference-profile-probe.mjs`和 reference HTTP/SSE 检查需要获准的本机回环监听，不能把沙箱 EPERM 当成产品失败。

两个 live runner 需要已有 `.env.local`、受限 BFF DB 配置、受控测试主体与显式 `QUANTOS_RUN_BFF_A2_LIVE=1`；本轮授权范围为临时受控测试与恢复原值，后续执行须遵守当时会话授权。它们直接连接现有 Supabase，不应建立本机 PostgreSQL/Supabase。runner 使用测试账号自己的资料、偏好、因素/会话并清理；追加审计保留。只执行 cargo 默认测试时，被忽略的 DB 测试不能记数据库 PASS。

本目录不承载 staging/发布/全角色/多实例/完整 UI E2E 验收，不自动更新计划、批准范围、Git notes、提交或推送。
