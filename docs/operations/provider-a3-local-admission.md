# PROVIDER:A3 本地聚合开发验收

依据前端开发执行计划 A3 窗口，`A3_LOCAL` 验证 BFF003 Research/Snapshot/Artifact、BFF005 Market 和 A2 Identity/Settings/Audit 的当前源码功能闭包。`A3_EXECUTION` 只执行共同检查，不能发布 READY。

| 回执 | 消费者 | 必要节点 |
|---|---|---:|
| A2_LOCAL | PROVIDER:A2 | 17 |
| R1_LOCAL | CORE-GATE:R1-SERVICE | 27 |
| BFF003_LOCAL | FE:BFF-FE-003 | 40 |
| BFF005_LOCAL | FE:BFF-FE-005 | 40 |
| A3_LOCAL | PROVIDER:A3 | 42 |

A3 聚合回执同时绑定三份直接消费者已发布回执的路径、哈希和同一完整源码 SHA，递归验证其输入、规范范围、全部必要测试日志、功能产物和依赖。不得混入历史成功结果，缺失、改写、错误 Gate 或不同候选均拒绝。五份回执与两份计划一次发布；发布后校验失败须全部回滚。

冻结实现源码并保持 Git 工作树干净后，用新的 attempt 目录运行：

```sh
PATH=/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:$PATH \
  node scripts/record-research-local.mjs \
  docs/audit/evidence/provider-a1-remediation-20261004/provider-a3-local-20261013/attempt-01
make research-local-check
make provider-a3-local-check
node scripts/reassess-a3-prerequisites.mjs
node scripts/provider-a2-development.mjs
node scripts/bff-fe-003-development.mjs --ready
node scripts/bff-fe-005-development.mjs --ready
node scripts/check-development-plans.mjs
```

执行器剥离数据库和生产凭据、关闭目标数据库开关、使用离线依赖，只执行本机真实模块、内存/合成 Engine、loopback HTTP/SSE 和基本浏览器功能。命令超时仅限制测试执行，不是性能达标证明。历史产物临时生成后恢复原字节，新证据保存在独立目录。

发布清单位于 `docs/audit/evidence/provider-a3-local-20261013/`。最后文档/证据提交只登记冻结候选的结果；验证器继续比较当前功能输入和规范范围，不声称自动验收后续 HEAD。功能输入变化必须重新冻结并执行完整闭包。

外部数据库迁移/RLS/事务、Auth/Storage/worker 持久恢复、来源用途许可、外部服务/部署、完整浏览器矩阵、同 SHA hosted CI、性能/容量/长稳仍为 `NOT_RUN`，由 RELEASE-GATE:BETA 实际验收。UI/consumer 跨模块功能链在对应 I 迭代验证。DEVELOPMENT READY 不授予上游独立 Gate、不构成正式 ACCEPTED、生产权限或发布授权。正式验收仍按[项目用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)执行。
