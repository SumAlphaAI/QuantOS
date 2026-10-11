# R03 开发实现与验收证据（2026-10-11）

> 当前复评更新：32条事实的限时内部用途已独立确认；新R03目标/七组工程PASS，前置53 PASS/5 FAIL/2 NOT RUN，开发Supabase只读且100任务收尾阻塞。R03 admission实际拒绝，Gate仍BLOCKED；以下正文为原历史快照，当前结果见[前置复评报告](./R03-prerequisite-readmission-2026-10-11.md)。

**限定开发工程验证 PASS；DEVELOPMENT Gate BLOCKED；formalAccepted=false。** 冻结源码 `0819addc639208dc5f2ae66d96a771a08fb9db87`，七组开发回归全部通过；已配置开发 Supabase 的完整生命周期测试通过。当前五项前置回执未重新准入，R02 历史真实行情来源授权已过期，因此不授予 R03 READY、R04 联调、R1 总 Gate、正式 ACCEPTED、同 SHA hosted CI 或发布。

[原内容绑定 manifest](./evidence/r03-prerequisites-20261011/initial/r03-before-readmission-manifest.json) 摘要 `sha256:292fd8081300da79684f79cb061cad3612af6912417e8ea7115e83ce46278ecb`；[执行台账](./evidence/r03-20261011/final/execution-results.json)、[目标回执](./evidence/r03-20261011/final/target/receipt.json)、[完整目标结果](./evidence/r03-20261011/final/target/lifecycle-result.json)与[前置核验](./evidence/r03-20261011/final/prerequisites.json)分别保存原始事实。后续提交只收尾文档/证据，源码字节仍由 manifest 独立验证，不把历史 source SHA 迁移为新 HEAD 的正式批准。

## 交付与范围

- `ResearchWorkflowCoordinator` 与 `PgResearchWorkflowCoordinator`：请求 hash 绑定 snapshot/policy/capability/schema，原子 schedule/request、幂等检查点保留、按工作流 claim、TP02 双 RPC 与流式事件/证据核对、deadline 与 attempt fencing。
- Artifact repository：PostgreSQL prepared/completed checkpoint + 强制 create-only 私有 Storage；分别核对 Engine SDK hash 与真实归档字节 hash；tenant/run 与 tenant/actor 重放，物理去重保留每次运行证据。
- 取消：排队与运行中分开处理，当前 actor/workspace/capability 复核，状态/审计单 SQL 原子提交，运行中须 Engine ACK；真实单调时钟包含请求至持久确认返回的完整数据库往返。
- Storage SQL 兼容 Runtime `verify-full`/已配置 CA，使用 OpenSSL 避免 macOS 原生 TLS 对目标证书有效期的兼容限制；保留证书校验。
- 无新增数据库迁移、无数据库重建、无本地 PostgreSQL/Supabase。所有新增目标数据为专属合成 fixture；未执行真实行情、模型、工具、订单、生产凭据或外部发布。

运行/API/checkpoint 说明见 [R03 summary](../execution/R03-summary.md)。源码变更包括 Runtime/Storage、通用 gateway worker 类型过滤、Makefile、三个 R03 脚本与测试；[完整文件清单](./evidence/r03-20261011/changed-files.txt)包含本地源码及证据收尾文件。

## 实测矩阵

| 检查 | 结果 | 原始证据 |
|---|---|---|
| Rust Runtime / Storage lib | 19 / 22 PASS | [runtime.log](./evidence/r03-20261011/final/logs/runtime.log) |
| Runtime→Manager→RD-Agent / Proposal 回归 | 2 / 3 PASS；研究 fixture 连续十次 | [engines.log](./evidence/r03-20261011/final/logs/engines.log) |
| TP02 contract + development | 131 PASS | [tp02.log](./evidence/r03-20261011/final/logs/tp02.log) |
| Manager 全量 lib/negative/各 Python Engine 集成 | 55 PASS | [manager.log](./evidence/r03-20261011/final/logs/manager.log) |
| Clippy（Runtime/Storage/gateway all-targets） | PASS，`-D warnings` | [clippy.log](./evidence/r03-20261011/final/logs/clippy.log) |
| Development Plan 结构/依赖 | PASS；0 READY / 158 NOT_ASSESSED / 1 BLOCKED | [plans.log](./evidence/r03-20261011/final/logs/plans.log) |
| R03 Gate 正/负向 | 16 PASS | [gate-negatives.log](./evidence/r03-20261011/final/logs/gate-negatives.log) |
| 实际 manifest 篡改探针 | 10/10 拒绝 | [probes](./evidence/r03-20261011/final/manifest-probes.json) |
| 源码提交凭据扫描 | 无泄漏 | [secrets.log](./evidence/r03-20261011/final/secrets.log) |

实际执行命令（独立移除数据库/服务密钥环境的本地回归；UDS 需要允许本机 socket）：

```sh
env -u DATABASE_URL cargo test -p quantos-runtime -p quantos-storage --lib --locked
env -u DATABASE_URL cargo test -p quantos-runtime --locked --test research_orchestration --test signal_proposal_orchestration -- --skip r02_retained_market_persistent_research_chain --skip r03_configured_supabase_lifecycle --skip r03_worker
engines/.venv/bin/python -m pytest engines/tests/test_rd_agent_contract.py engines/tests/test_rd_agent_development.py -q
env -u DATABASE_URL cargo test -p quantos-engine-manager --locked
cargo clippy -p quantos-runtime -p quantos-storage -p runtime-gateway --all-targets --locked -- -D warnings
node scripts/check-development-plans.mjs
node --test scripts/r03-stage-check.test.mjs
QUANTOS_R03_EVIDENCE_DIR=artifacts/r03-target/attempt-06 make r03-target-check
node docs/audit/evidence/r03-20261011/final/manifest-probes.mjs
node scripts/r03-stage-check.mjs --verify
make r03-admission-check
```

最后一条预期拒绝当前前置未 READY，拒绝证据保存在 [admission.log](./evidence/r03-20261011/final/admission.log)。重跑目标测试须选择新的空 evidence directory，不能覆盖 `attempt-06`。

目标结果：同一合成 fixture 连续 **10 次、1 个语义 input hash、10 份可定位证据**；排队取消 **230ms**、运行中取消 **621ms**，均 ≤2s。分别启动独立 worker 进程，第一次在 prepared 后受控上传失败，随后在上传/绑定后模拟 worker 消失，重启进程刻意没有 Engine 路由仍恢复成功。旧 lease 写入拒绝；11 个成功 run 仅 11 份 Artifact 绑定/11 个成本单位，恢复重复成本为 0。另 2 个取消 run 无 Artifact、无成本扣减；跨租户/actor 重放及取消拒绝。所有本次 actor inactive、session revoked、tool disabled、pending run=0；不可变事实与本次归档对象保留为证据。以上是配置开发目标上的应用/持久层功能测试，不是部署身份链或目标 RLS 全量验收。

## 已修复缺口与失败历史

修复固定 50ms 取消回执、无租户 hash/id 查询、仅输入正文 hash、同键重试覆盖 checkpoint、仅内存 Artifact、无字节核对，以及研究/fixture worker 混领和非 Execute 错误状态收尾。对应代码与正/负向测试已收录。

[原始尝试](./evidence/r03-20261011/initial/)保留 UDS 沙箱拒绝、编译/Clippy、fixture 缺少 causation、TLS 兼容及第五次目标取消超时。第五次已经完成十次归档及独立进程恢复，但排队取消超过2秒，整体 FAIL；不能用这些部分成功替代最终通过。第六次冻结源码全量重新执行 PASS，未降低2秒标准、未伪造计时。

收尾复核：[计划负向38/38](./evidence/r03-20261011/final/document-plan-negatives.log)、[最终验证](./evidence/r03-20261011/final/validation.json)与[完整证据凭据扫描](./evidence/r03-20261011/final/evidence-secrets.log)通过；72个功能输入文件与冻结运行/目标回执完全一致。

## Gate 与未决风险

[14 个失效旧 Gate](./evidence/r03-20261011/initial/invalidated-gates.json)因功能输入变化撤销为 NOT_ASSESSED；旧 manifest、历史确认与正式状态完整保留。F07/F08/R02/TP02/F0 均须重新完成当前递归闭包准入，本轮局部回归不授予其 READY。R02 真实来源授权校验仍返回 `source approval expired`（[原始拒绝](./evidence/r03-20261011/initial/local/r03-source-policy.err)），本轮合成来源不续签或替代原授权，不扩大原1800秒/两标的/内部用途。

仍未验收：部署 HTTP/JWT/当前成员权限链、受限 Storage 身份、候选同 SHA hosted CI、代表性负载/性能/长稳与真实模型/token/金额预算。流事件目前在 gRPC 收集后归档，浏览器实时 SSE 与逐条持久投递未实现；研究长任务无 lease heartbeat，必须配置有效 lease。Artifact API 是服务库，HTTP 调用方须先提供可信鉴权上下文，不能直接信任客户端 tenant/actor 参数。

[项目用户确认文稿](../gate-records/R03-development-user-confirmation-draft-2026-10-11.md)为 PENDING；依据[统一规程](../gate-records/user-acceptance-confirmation-workflow.md)，Codex 不代用户确认，用户确认也不能替代未闭合的工程依赖。当前正式 ACCEPTED、CI、部署与发布均未授予。

下一可执行任务：先拟定/确认 R02 来源授权处理范围，完成 F07/F08/R02/TP02/F0 当前闭包复评，再执行 `make r03-admission-check`；R03/TP03/TP04/F0 当前全部 READY 后才能执行 R04 集成。仅生成本地 Git 提交，未推送。
