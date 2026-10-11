# R03 Research orchestration 与 Artifact lifecycle

开发实现提供 `ResearchWorkflowCoordinator`（内存测试）与 `PgResearchWorkflowCoordinator`（配置的 Supabase PostgreSQL + 私有 Storage）。持久化路径复用既有 Runtime 表，无新增迁移、数据库重建或本地数据库。原实现见[执行报告](../audit/R03-development-2026-10-11.md)，当前准入采用[R03_LOCAL策略](../audit/R03-local-gate-policy-2026-10-11.md)；原Supabase复评与退役收尾见[历史前置报告](../audit/R03-prerequisite-readmission-2026-10-11.md)。

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
# 干净提交上完整执行本地前置与R03，生成限定开发回执。
make r03-assess-local
QUANTOS_SKIP_ENV=1 make r03-check
# 发布验收时另行执行：仅配置的Supabase，需可写目标与适用授权。
QUANTOS_R03_EVIDENCE_DIR=artifacts/r03-target/<fresh-attempt> make r03-target-check
node scripts/r03-stage-check.mjs --verify
make r03-admission-check
make r03-release-check # 本地准入不能满足发布验收
```

本地 UDS fixture 服务需要允许建立本机 socket；静态/本地通过不代表数据库验收。目标脚本拒绝非 Supabase、项目不匹配与缺失 CA，使用配置凭据且不打印凭据；所有失败及清理结果保留。目标使用专属合成来源；R02的32条保留事实仅按独立限时许可内部复验，原采集授权仍已到期。

R03开发Gate仅消费15节点闭包的LOCAL_READY功能投影，要求全部非Supabase命令、F07本地Runtime/gateway与R03七组回归实际通过；不发布其他任务的全范围READY。真实数据库前置及R03目标项按清单移交RELEASE-GATE:BETA，标记NOT RUN。当前新范围待完整执行，NOT_ASSESSED。

开发Supabase默认只读与历史失败保留；100个自有任务已退役，独立读回pending=0，见[恢复记录](../audit/R03-supabase-recovery-2026-10-11.md)。不升级订阅、不建立本地数据库。本地准入、用户工程确认、同SHA CI与最终发布分别验证，formalAccepted=false；参考[统一规程](../gate-records/user-acceptance-confirmation-workflow.md)。
