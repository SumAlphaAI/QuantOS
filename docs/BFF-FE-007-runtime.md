# BFF-FE-007 live Audit / export runtime

C10 的六个 API 保持 OpenAPI 1.5.0 和生成客户端契约。`QUANTOS_BFF_MODE=live` 接入配置的 Supabase Auth/PostgreSQL；reference 模式仅供 loopback 回归。数据库迁移使用 `scripts/apply-reviewed-migrations.cjs`，不启动本地数据库。

## 配置与接线

使用现有 `QUANTOS_BFF_DATABASE_URL`（专用 BFF 登录、TLS CA）、`SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`、`QUANTOS_TERMINAL_ORIGIN`、`QUANTOS_BFF_ENVIRONMENT`、`QUANTOS_TRACE_EXPORT_PATH`。新增服务端 `QUANTOS_BFF_STORAGE_KEY` 用于私有 Storage；开发配置可使用现有 `SUPABASE_SERVICE_ROLE_KEY`，只在服务端读取。缺少 Storage 配置时 live 启动失败，不发布占位下载。

应用 `20261006100000_bff_audit_exports.sql` 、`20261006110000_bff_audit_scope_indexes.sql`、`20261006120000_bff_domain_audit_read_model.sql` 和 `20261006130000_bff_settings_audit_bridge.sql`。bucket `quantos-bff-exports` 必须为 private，最大对象 16 MiB。Terminal origin 需反向代理 `/_bff/export-content/*` 到同一 live BFF；该路径是下载 URL 指向的二进制资源，不是新增页面 API operation，也不向消费者暴露 Storage 凭据或对象键。

## 授权、范围与审计

每个请求重新加载真实身份/capability；创建/取消还检查同源、CSRF、session 绑定的五分钟 recent-auth。完成的幂等命令仍检查当前权限与 recent-auth。actor/tenant/workspace/account、operation/key/target 及完整规范化 scope（含 eventKinds/startAt/endAt）共同绑定意图；冲突不写业务或审计数据。

F05 `audit_entries` 的 BFF RLS 限定当前 actor 与 tenant，并匹配已声明的 workspace/account；没有可见关联链的 scope 返回隐藏的 404。历史未声明账号的 actor 自身账本记录仍可读取，其他 actor 的记录不开放。域 eventId、event_kind、sequence、对象信息来自 F05 event_log，auditRef 保留独立审计行 ID；证据链去重域事件，保留真实 causation。既有身份/设置审计由同事务 trigger 追加到 F05，仅映射可验证主体及唯一当前 scope，历史行不改写。创建时固定授权的脱敏快照，worker 不扩大查询范围。

`audit-v1` 采用字段白名单，自由 reason/watermark 与未知敏感字段不进入导出的审计载荷；可见水印为服务端固定标签与请求文本摘要。`payloadHash` 对实际返回的脱敏载荷做 canonical JSON SHA-256，文件摘要/长度来自最终字节。原始 F05 数据没有被改写，也不把脱敏载荷摘要冒充原始业务载荷摘要。

读取、拒绝、导出创建/生成/完成/失败/取消/过期、票据签发/消费/拒绝留持久 F05 记录。读取访问记录使用独立 correlation，避免污染被读取的业务因果链。无可验证主体的请求拒绝记录在服务 trace 中；下载票据和签名不写入 trace。

## 分页、生成与下载

服务器保存五分钟分页快照及高熵游标摘要，绑定身份、查询、链与 pageSize；伪造、跨查询或过期游标返回 422。每页 1–200 条，快照最多 10,000 条；超过边界返回 429。排序以 eventId 作为稳定次序，分页不被新增访问审计打乱。

导出创建持久 queued 任务；独立 worker 使用数据库 lease/fencing token 生成 JSONL、CSV 或 PDF，上传私有对象后发布 ready。GET status 不生成文件。过期 lease 可在进程重启后恢复；最多三次生成尝试，失败进入 failed。生成中取消先 fence lease，cancel_requested 由 worker 完成；ready/queued 可直接 cancelled。清理进度保存在数据库，失败清理不会阻塞其他任务。

签名资源 lease 最长五分钟，并不超过 retentionUntil，绑定用户与 session。下载重新核验当前能力、owner/context、job 状态和数据库时间；票据以条件更新原子消费，两个并发请求只有一个可消费。下载失败的消费尝试也会用掉票据，可重新请求元数据。取消、过期和 session 吊销拒绝后续消费；Storage 签名密钥轮换也会使旧签名失效。实际字节摘要与长度不符时返回安全 503 并审计，绝不返回损坏产物。

每 actor/operation 的一分钟窗口配额：createExport 5 次，其他受限操作 120 次；超限返回 429 / retryAfter。64 KiB 请求体限制由公共输入 guard 执行。

## 验证与准入

`check:bff-fe-007` 是 local contract 检查；`check:bff-fe-007:development` 独立校验当前源码/计划摘要、三项前置回执、已执行语义/mutation 日志及 Supabase 目标强断言。两者都接入 Frontend Baseline / Makefile，不以注释 marker 作为功能准入。

目标脚本 `QUANTOS_RUN_BFF_AUDIT_LIVE=1 node scripts/test-bff-fe-007-live.mjs <evidence-directory>` 仅使用配置的现有测试账号，恢复 capability/配额/MFA 并删除临时 session、任务与私有对象，保留 append-only 合成审计。按报告独立区分开发功能、hosted CI、部署/IdP、目标规模 SLA、PROVIDER:A2/ALL 和正式用户确认。
