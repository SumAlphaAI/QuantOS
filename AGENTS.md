# QuantOS 工程环境约定

## 数据库

- 本机不安装或运行 PostgreSQL、Supabase CLI 本地服务或 Supabase 本地环境。
- 不要尝试在本机通过 Docker、容器、临时数据库或其他方式建立隔离的 PostgreSQL/Supabase 环境。
- 所有需要数据库连接的开发、迁移、检查和测试操作，均直接连接已配置的 Supabase PostgreSQL。使用工程现有的 `DATABASE_URL` 等连接配置，不在代码或文档中写入凭据。
- 数据库相关操作应明确区分本地静态检查与实际 Supabase PostgreSQL 执行结果；未连接目标数据库的测试不能记作数据库验收通过。

## 验收确认

- 所有原需六方或多个项目角色确认的验收，由 Codex 拟定完整确认文稿，项目用户一人确认即可；原含 Domain 的七角色验收同样适用。
- 用户在本会话直接确认或修改文稿，Codex 保存原始答复、文稿/范围摘要并执行门禁；不要要求用户收集六份角色回执，不得自行批准。
- 统一规程为 `docs/gate-records/user-acceptance-confirmation-workflow.md`。保留历史签署；工程证据、用途许可与业务权限控制仍按任务要求执行。
