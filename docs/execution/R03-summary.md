# R03 Research orchestration 与 Artifact lifecycle

开发实现提供 `ResearchWorkflowCoordinator`（内存测试）与 `PgResearchWorkflowCoordinator`（配置的 Supabase PostgreSQL + 私有 Storage）。持久化路径复用既有 Runtime 表，无新增迁移、数据库重建或本地数据库。验收与限制见 [本轮报告](../audit/R03-development-2026-10-11.md)。

## 请求与调度

仅允许 `research` 工作流、TP02 hypothesis/experiment capability、v1 对象输入、非空 policy/idempotency 及正预算/速率。语义 input hash 绑定 capability、DataSnapshot、policy、schema 与输入，不包含新 run/correlation ID；同一 fixture 重复运行保持一致。Runtime session/tool/capability/速率与成本上限仍由 F07 执行。

PostgreSQL 使用同一 SQL statement 原子写入 workflow 和初始 checkpoint。精确幂等重试返回原 run，不回退 checkpoint；更改 snapshot/policy 等语义输入的同键请求被拒。通用 fixture worker 只领取 `runtime.fixture.v1`，研究 worker 只领取 `research`，避免互相消费。每个已绑定 Artifact 消耗 1 个 Runtime budget unit；这不是未来真实模型 token/金额预算。

## 执行与归档

执行前重新读取 R02 快照、当前质量规则、reader 权限与服务端来源策略，检查实际事件血缘。随后通过已批准的 EngineManager 调用 TP02 `StreamExecute` 和幂等 `Execute`，核对 execution/input hash、租户/工作区/actor、snapshot/policy/capability、输出不可执行标记、证据引用与流序列。

TP02 Engine 的 mock URI 仅为来源引用。Runtime 将真实输出 canonical UTF-8 JSON 写入私有 Storage，独立计算实际归档字节 hash；SDK ASCII JSON hash 用于验证 Engine 响应，二者不能混用。归档使用强制 create-only API，即使适配器 legacy upsert 配置开启也不覆盖对象；重复或不确定上传仅在读回字节相同时通过。单 Artifact 上限 4 MiB。

| checkpoint | step | 内容及恢复行为 |
|---|---:|---|
| research.request | 0 | 原子保存不可丢失的请求与 execution ID |
| research.dispatch | 1 | 保留请求；失败时由 Runtime 重试预算控制 |
| research.prepared | 2 | 完整输出、manifest、证据与流事件；上传前持久化 |
| research.completed | 3 | 保留 request + 完整 Artifact record；绑定后完成 run |

step 2/3 后重启从 PostgreSQL 恢复字节，上传/绑定去重，无需 Engine 再执行；旧 attempt 不能写入新 lease。`PgResearchArtifactRepository::replay(tenant, actor, run)` 先核对归属与成功状态，再检查绑定/manifest并从 Storage 验证实际字节。内存仓库同样按 tenant/run 索引，物理内容去重不吞掉每次运行证据。

## 取消、deadline 与运行约束

`PgRuntimeStore::request_research_cancel(tenant, actor, run, at)` 复核当前 actor、工作区和 capability，在一次原子数据库往返内写状态及审计；排队取消直接终止，不调用未启动的 Engine。运行中取消由独立的已授权 Runtime 控制连接请求；研究 worker 轮询状态，使用共享执行归属的 Manager clone 调用 Cancel，只有 Engine 返回 `cancelled=true` 才以相同 attempt 确认终态。拒绝/超时不能假装成功，验收计时来自请求发出至持久确认返回的真实单调时钟，包含数据库往返。

Manager RPC deadline 与 worker lease deadline 共同约束执行，超时/失败不能归档成功；checkpoint、Artifact 绑定、完成与取消确认使用 F07 fencing。持久 coordinator 必须运行在 Tokio multi-thread executor；目前不提供长任务 lease heartbeat，应按已批准的最大研究时长设置 lease。真实模型调用与费用记账需另行设计和验收。

## 执行命令与准入

```sh
QUANTOS_SKIP_ENV=1 make r03-check
# 仅使用既有开发 Supabase；生成专属合成 fixture，并停用 actor/session/tool。
QUANTOS_R03_EVIDENCE_DIR=artifacts/r03-target/<fresh-attempt> make r03-target-check
node scripts/r03-stage-check.mjs --verify
make r03-admission-check
```

本地 UDS fixture 服务需要允许建立本机 socket；静态/本地通过不代表数据库验收。目标脚本拒绝非 Supabase、项目不匹配与缺失 CA，使用配置凭据且不打印凭据；所有失败及清理结果保留。目标合成来源策略不能替代 R02 历史行情已到期授权。

R03 工程证据、五个当前前置 Gate、项目用户确认、同 SHA hosted CI 与发布分别验证。当前前置未闭合，禁止据本摘要将 R04/R1 总 Gate 自动标为 READY；参考 [统一确认规程](../gate-records/user-acceptance-confirmation-workflow.md)。
