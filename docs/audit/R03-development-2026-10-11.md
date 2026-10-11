# R03 开发实现与验收证据（2026-10-11）

当前结论：实现与验证进行中；R03 DEVELOPMENT Gate 为 BLOCKED。F07/F08/R02/TP02/F0 当前依赖回执尚未闭合，R02 历史来源授权已到期，不能继承旧 READY/确认/CI。所有后续实测与残留将记录于本报告；不授予正式 ACCEPTED、R1 总 Gate、部署或发布。

实现范围见 [R03 summary](../execution/R03-summary.md)：原子研究调度、语义 input hash、TP02 双 RPC/流式证据、持久 prepared/completed checkpoint、强制 create-only Storage、真实字节验证、tenant/actor replay、worker attempt fencing与真实取消计时。使用现有配置的开发 Supabase，新增数据全部为专属合成 fixture，未运行真实行情、LLM、订单或外部发布。

## 初始问题与关闭依据

| ID | 原始问题 | 本轮实现 |
|---|---|---|
| R03-01 | 取消回执固定加 50ms，没有实际计时 | 使用单调时钟/数据库时间；区分 queued 与 running Engine ACK |
| R03-02 | Artifact 查询只按 hash/id，跨租户可误配 | tenant/run 与 tenant/Engine ID 索引，独立保留每次运行证据 |
| R03-03 | 请求 hash 不含 snapshot/policy；幂等重试覆盖 checkpoint | 语义 hash、原子 schedule/request、同键冲突拒绝、重试不回退 |
| R03-04 | 只有内存 Artifact，重启恢复未验证 | PostgreSQL prepared/completed 与真实 Storage，独立进程恢复 |
| R03-05 | 信任 Engine Artifact sha256，没有对应字节验证 | SDK 与归档 hash 分离，输出身份/证据/流事件检查，Storage读回 |
| R03-06 | 非 Execute 错误留下 running、worker类型混领 | 全错误状态收尾、按工作流类型 claim、deadline/lease fencing |

初次本地 UDS 沙箱失败、编译/fixture/TLS兼容问题及每次目标尝试均保留，不作为成功证据。无需迁移或重建共享数据库。

## 未决边界

- R02 历史来源授权过期；保持原1800秒/两标的/内部用途边界，Codex不续签。R03 合成来源不替代该授权或当前 R02 Gate。
- 本轮变更使部分旧功能 manifest 输入失效；当前 Gate 必须按源码、命令、依赖与目标证据重新准入。
- 工程服务身份/Storage管理员诊断、部署HTTP/JWT链、受限部署凭据、候选同SHA hostedCI、代表性负载/长稳与真实模型/token预算仍未验收。
- 缓冲收集 Engine gRPC 流事件并归档；对浏览器的实时 SSE/持久事件逐条投递不在本服务库实现范围。长任务需配置有效 lease，目前无研究 worker heartbeat。
- 唯一项目用户确认待办；继续开发授权不等同于确认文稿，历史签署保留。

下一可执行任务：先完成R02来源授权范围的项目用户决策及F07/F08/R02/TP02/F0当前闭包复评，重跑R03准入；只有当前R03/TP03/TP04/F0就绪后才能推进R04联调。
