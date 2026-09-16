# BFF-FE-007：Audit 与导出 API 交付摘要

> 日期：2026-09-16
> 范围：A2 / C10 / P04、P07、P09–P14、P22、P23
> 仓库状态：本地实现与可重放 Gate 完成；GPT-6 Astra 复审、staging 与目标基础设施验收未执行

## 交付结果

- OpenAPI 升级到 `1.3.0`，发布 `searchAuditEvents`、`getEvidenceChain`、`createExport`、`getExportStatus`、`cancelExport`、`getExportDownload` 六个 C10 operation；同源生成 client、Zod、JSON Schema、operation manifest 与 MSW handlers。
- 搜索和证据链使用不透明 cursor 与受限 page size，响应仅包含服务端脱敏载荷、payload hash、retention 与 correlation/causation 链信息；未知或无权资源按 404 隐藏。
- 导出创建/取消同时要求 cookie session、CSRF、幂等键与 recent-auth；status 不泄露 URL；仅 ready 作业可获取最长五分钟的水印下载元数据，过期返回 410。
- Rust 本地参考 provider 覆盖搜索、证据链、导出状态机与全生命周期审计；Terminal typed gateway 统一携带 cookie/安全头并将拒绝与过期错误映射为安全错误。
- 新增仓库 Gate 与 10 个破坏性负向探针，并接入 `Makefile` 和 Frontend Baseline CI。

## 验收边界

本次 `COMPLETED` 仅表示源码、生成物、本地参考 provider、前端 gateway、测试、文档与可破坏 Gate 已闭环。以下不据此视为完成：真实 PostgreSQL 审计投影查询、对象存储签名与一次性下载语义、staging consumer/provider contract 签署、目标环境五分钟还原实测、GitHub Actions 远端运行、GPT-6 Astra 功能复审。

详细命令、结果与风险见 [验收证据](./audit/BFF-FE-007-acceptance-evidence-2026-09-16.md)。
