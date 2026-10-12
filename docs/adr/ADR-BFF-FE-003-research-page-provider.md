# BFF-FE-003 Research 页面 provider

状态：工程实现；正式接受待确认。日期：2026-10-12。

C03/C04 页面 provider 使用独立路由，reference 只用于 loopback fixture；live 只接受现有 BFF middleware 提供的身份。创建和取消复用 R03，不从 BFF 执行 Engine，也不注册或启用工具。现有 Runtime gateway 的 fixture worker 不是 research worker，不能替代 PgResearchWorkflowCoordinator。

OpenAPI 1.6.0 发布第九项 getArtifactAttachment，创建/取消使用 ResearchAccepted，包含 jobId、statusRef、correlationId 和 auditRef。问题非空，预算为 1–1000000 的规范整数字符串，deadline 必须在未来 24 小时内，附件最多 16 个且不可重复。Research 预算是整数成本单位，不使用浮点数计算。Hash 为 sha256: 加 64 位十六进制。历史宽松请求约束的工程修正登记于现有兼容性登记表；该登记不代替正式消费者/用户确认。

生产适配器先持久化完整命令意图与 Runtime session/correlation，再提交 R03 队列。重试复用原始输入指纹；队列提交后响应保存失败时可恢复。同一命令的响应、Audit/F05 镜像、页面流事件在一个 BFF 事务中提交。取消也先保存意图。R03 worker 继续负责租约、强杀恢复、取消确认、Artifact/成本一致性。BFF 不声称 202 表示计算完成。

Snapshot 查询使用获准的 tenant，冷读 R02 规范记录；创建再次验证质量、许可证和服务端 source policy，不相信客户端标签。已授权的既有 Research Artifact 可作为附件，读取私有 Storage 后验证规范字节/hash，拼入 RD-Agent 的 prompt；组合输入不得超过 8192 UTF-8 字节。不给 RD-Agent 发送其不支持的 attachments 字段。此版本不提供上传/恶意文件扫描能力。

列表最多物化 2000 条，支持允许的排序、等值筛选和 pageSize 1–200。超出范围返回 NARROW_QUERY，需缩小查询。opaque cursor 绑定 tenant/actor/workspace/account/mode、操作与完整查询，冻结页面内容，5 分钟后或进程重启后返回 CURSOR_EXPIRED；最多保留 128 个游标。应用每身份/操作每分钟最多 120 次请求；新研究命令另限 30 次/分钟。进程内限额需要在发布时结合实例数验收；不是跨集群配额证明。

SSE 将 F05 append_sequence 顺序的领域事件导入持久页面日志，以源事件 UUID 去重、逐 run 连续 sequence 回补；create/cancel 与页面事件原子提交。每次轮询重验会话、权限和完整上下文；撤权发 permission_revoked 并关闭；依赖不可用则关闭并允许携 afterSequence 重连。最多 64 个本进程流连接。此流发送领域状态事件，Engine 的完成证据通过 Artifact 读取；不声称逐 token 流或 UI 集成已完成。

Artifact 元数据包含可定位的 evidenceId/artifactId/summary，ResearchRun.evidenceRefs 使用相同稳定映射。附件返回已验证的 JSON 内容及 hash，不返回 Storage 路径/凭据。成本读取 R03 cost_used_units。当前 Engine 未报告 prompt/code 版本时明确返回 unreported，不以 fixture catalog hash 冒充源码版本；完整版本溯源仍待领域输出补齐。

SQL 迁移仅提供给配置的 Supabase 执行。本轮不应用迁移、不创建本地数据库、不接触生产凭据、不推送或发布。当前证据仅支持本地工程结论；A3 依赖、真实目标、I 迭代 UI/consumer、RELEASE 性能/同 SHA CI 和项目用户正式确认独立记录。
