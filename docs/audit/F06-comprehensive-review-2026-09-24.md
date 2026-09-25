# F06 身份、授权、秘密引用与主上下文复审结论

> 更新日期：2026-09-25。原 F06-A01–A10 **全部关闭，活动问题为 0**；当前 Gate 以[开发机远程延迟范围修订](./F06-A09-remote-latency-gate-withdrawal-2026-09-25.md)为准。
> 历史已验收基线：`44b8e73b5f28a9003689658cb75b13c73abd1489`。该 SHA 的 v1 PASS 回执不转移到新提交；`40300445da8aed0f874aa1f5369b5e42bdf11234` 的 v1 FAIL 回执保持原样。新提交必须绑定 v2 同 SHA PASS 回执。
> 原始缺陷描述及 `3/18` 初审统计可通过历史提交中的本文件追溯，不再作为当前未完成清单。

## 一、任务完成概况

F06 在已确认的服务端范围内具备真实 Supabase Auth 接入 BFF/Runtime、Primary 主上下文、RBAC/capability、跨租户约束、受控 Execution/Vault 路径及定量拒绝矩阵的目标证明。开发计划的复审结论保持 `ACCEPTED`；对当前 HEAD 的验收仍以新版同 SHA 总 Gate 为准。

| 级别 | 原问题数 | 已关闭 | 活动问题 | 关闭率 |
|---|---:|---:|---:|---:|
| 阻塞级 | 2 | 2 | 0 | 100% |
| 高危 | 5 | 5 | 0 | 100% |
| 中危 | 2 | 2 | 0 | 100% |
| 低危 | 1 | 1 | 0 | 100% |
| 合计 | **10** | **10** | **0** | **100%** |

统计口径为原 10 项问题的关闭率；不将它换算为初审 18 项检查点的本轮重跑完成率。范围调整见 [F06 边界修正](./F06-gate-scope-correction-2026-09-24.md)、[A09 同区域修正](./F06-A09-gate-scope-correction-2026-09-25.md)和[开发机远程延迟修订](./F06-A09-remote-latency-gate-withdrawal-2026-09-25.md)。

## 二、关闭证据索引

下表仅保留追踪编号和关闭依据，已解决的缺陷描述不再列入活动问题。

| 编号 | 模块 | 已核对的关闭依据 |
|---|---|---|
| A01 | Auth/BFF/Runtime | live 服务使用已验证 Auth 主体和服务器会话；总回执记录 BFF 9 项 HTTP 与 Runtime 身份拒绝链。[分项记录](./F06-A01-A08-target-review-2026-09-24.md) |
| A02 | Execution/Vault | 独立 Execution 进程经受限 Vault 到 paper kernel；有效提交及五种拒绝场景通过。[命令链复验](./F06-A02-command-path-review-2026-09-25.md) |
| A03 | 租户身份映射 | 组合租户外键、查询租户谓词、七种关联错配拒绝及 RLS 隔离通过。[A03–A05 复验](./F06-A03-A04-A05-target-review-2026-09-25.md) |
| A04 | Primary 主上下文 | 服务端从账户读取 mode；错误 mode 拒绝，账户模式变化后重读上下文并移除原模式 grant。[A03–A05 复验](./F06-A03-A04-A05-target-review-2026-09-25.md) |
| A05 | capability | Owner 明确白名单；Rust/SQL 的 execution 授权强制账户范围，缺账户、缺 mode、错 mode 和跨租户拒绝。[A03–A05 复验](./F06-A03-A04-A05-target-review-2026-09-25.md) |
| A06 | 数据库角色 | 独立登录、严格 TLS、角色独占及实际服务连接通过。[角色复验](./F06-A02-A06-A07-target-review-2026-09-25.md) |
| A07 | Vault allowlist | 命令账户绑定的四参数 resolver 取代应用旧入口；过期、轮换、引用撤销和会话撤销拒绝。[角色与路径复验](./F06-A02-A06-A07-target-review-2026-09-25.md) |
| A08 | 拒绝矩阵 | 四类请求 4/4 拒绝；UI/用户/BFF/Engine 四角色两路径 8/8 SQLSTATE `42501`。[总回执](./F06-accepted-baseline-44b8e73.json) |
| A09 | 鉴权性能范围 | 历史基线 P95 **317.415ms**；本机链路长尾导致 `4030044` 旧范围失败。经用户确认，开发机跨区域 P95 转为诊断，同区域性能移至首次部署验证。[范围修订](./F06-A09-remote-latency-gate-withdrawal-2026-09-25.md) |
| A10 | 状态治理 | 开发完成与验收分开；干净工作树、全部 CLOSED、同 HEAD v2 Git note 与三组 PASS 为总 Gate 条件，负向探针验证失败闭锁。[验收说明](./F06-final-same-sha-acceptance-2026-09-25.md) |

[归档 JSON](./F06-accepted-baseline-44b8e73.json)是历史基线 Git note 原文副本；其 `sourceCommit` 未改写。任何新 HEAD 不继承该回执，严格 HEAD Gate 在没有新 SHA v2 回执时应失败，不能用本报告代替。

## 三、活动问题及验收边界

**原 F06 活动问题清单为空。** 以下为后续任务或交付边界，不计为已关闭问题重新开放，也不宣称已完成对应验收：

- Terminal 浏览器、MFA 页面及全部页面 API 联调由 Web G1/页面阶段承接；同区域 <100ms 在首次同区域部署后验证。开发机跨区域 P95 保留诊断，当前测量未达旧 `<500ms` 阈值。
- Execution 使用隔离合成 paper 命令；X03 签发、可信传输、真实 venue 凭据交付需另行验收。
- Runtime 身份测试临时使用已授权高权限 Storage key，未执行 Storage 操作；正式受限 Storage 凭据另验。Supabase 平台 `service_role` 解密视图权限属于运维例外，应用角色不继承它。
- 新建参考库的 `db-schema-diff` 尚未运行，不能称为 schema drift PASS。
- `4030044` 的 v1 FAIL note 已与远端 `refs/notes/f06-acceptance` 同步；它不能被改写成 v2 PASS，也不能替代新提交的回执。归档副本随文档提供历史证据，不改变严格 HEAD Gate 的要求。

## 四、维护与后续操作

无需继续按 A01–A10 安排代码修复。后续修改身份、授权、Vault、相关迁移或验收范围时，应在新的完整 SHA 收集新版三组目标回执，按同一 Gate 重新验收。

已验收基线的 note 可用以下命令读取：

```bash
git notes --ref=refs/notes/f06-acceptance show 44b8e73b5f28a9003689658cb75b13c73abd1489
```

共享此 note 需单独推送 `refs/notes/f06-acceptance`；GitHub Desktop 推送分支不保证同步 notes。分项旧报告保留当时结果，最新状态以本报告、开发计划和指明 SHA 的回执为准。
