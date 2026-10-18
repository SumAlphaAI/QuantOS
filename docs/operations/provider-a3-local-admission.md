> PROVIDER:A3当前功能使用[A3_SCOPE_LOCAL规程](provider-a3-functional-admission.md)，下述全闭包仅保留历史原范围，不作为开发默认入口。

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

## 2026-10-14 聚合复验

当前共同执行为A3_EXECUTION的42节点/141组：原140组加TP02专用Gate负向。五消费者必要检查仍为A2 17/67、R1 27/85、BFF003 40/135、BFF005 40/135、A3 42/140；额外从同候选实际执行派生TP02_LOCAL完整13节点/44组，用其独立publisher重新准入。执行owner不等于消费者owner，逐节点重绑scope/依赖并完整验证，不能拼接旧TP02或A3回执。全图成功后仅上述五消费者与TP02六项DEVELOPMENT READY，其他上游不授予独立READY。

新attempt示例：`node scripts/record-research-local.mjs docs/audit/evidence/provider-a1-remediation-20261004/provider-a3-readmission-20261014/attempt-01`；已有attempt拒绝覆盖。共同执行前保持干净冻结提交，canonical组件先存临时目录，成功/失败均保存生成差异并恢复原字节；旧五份wrapper、TP02 wrapper、publication及两份计划归档到本轮history，供同Git blob复核。六份发布发生异常时回滚全部wrapper和计划，记录publication-failure.json。

测试fixture必须隔离当前其他独立Gate，不能因合法TP02 READY使聚合测试误报失败，也不能为通过聚合测试删除真实Gate。共享策略变化须撤回受影响旧READY，再从新候选完整复验；外部环境/数据库/性能/正式验收保持原NOT_RUN移交边界，不使用生产凭据、不升级订阅、不推送或外部发布。
