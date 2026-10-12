# TP01-C_LOCAL 本地功能准入

TP01-C_LOCAL 只授予 CORE:TP01-C 的 DEVELOPMENT 功能准入。必要闭包固定为 F01–F09、TP01-A/B、F0、TP01-C，共 13 节点；完整执行 45 组唯一检查，生成同一冻结源码上的消费者投影。F0/F08/TP01-A/B 等上游节点不因投影被登记 READY，R1-SERVICE 也不自动放行。

`scripts/provider-a1-policy.json` 登记完整检查集；`scripts/tp01-c-local-gate.mjs` 验证候选、规范输入、13 节点/所有命令与日志、支持制品及依赖摘要。组件工程检查不跳过五 RPC、20 回放、100 组双 RPC 拒绝、Artifact 租户/完整性、取消/deadline/幂等、独立 Engine 路由；F07 使用本地 Runtime/gateway 功能，最后实际核验本轮拥有的 Engine 进程，无遗留才可准入。

入口：

```sh
# 先提交全部源码与规范输入；必须从干净工作区执行。
node scripts/record-tp01-c-local.mjs docs/audit/evidence/provider-a1-remediation-20261004/tp01-c-local-20261012/attempt-01
make tp01-c-local-check
# 无完整目标和正式发布证据时必须拒绝。
make tp01-c-release-check
```

记录器在执行前用临时目录保存旧 canonical 回执，执行后（成功或失败）写入独立 history；不得覆盖既有 attempt/history。新回执只在全部检查成功、输入未漂移且依赖验证通过后发布。发布器先验证新回执，再替换 manifest 和两份计划；写入/发布后验证失败恢复原字节，首次发布失败删除新建 manifest。旧严格 `--assess-tp01-c`/`--ready` 继续要求完整目标准入，不能用于本地开发放行。

以下 12 组旧目标检查记录为 NOT_RUN 并由 RELEASE-GATE:BETA 首次发布前实际验收：F02 数据库、F05 数据库/容量、Storage 数据库/目标、RLS、F06 目标、F07 恢复/覆盖/服务、F09 目标，以及 TP01-A 远程治理。TP01-A 的本地替代只检查固定 readonly/controlled fork、远端 URL/push 禁用、LICENSE/NOTICE/锁和 SBOM/CVE 记录摘要，显式 `--skip-remote-governance 1`；不读取 GitHub 凭据、不验证远程分支保护。依赖 SCA 的公共漏洞库查询仍属软件安全检查，不构成 GitHub/Supabase/部署验收；历史固定 CVE 记录不声称是实时扫描。

Supabase 容量/默认可写、迁移/RLS/事务/Auth/Storage、持久 Artifact/取消恢复、部署权限、OS egress 隔离、性能/长稳及同 SHA hosted CI 都不由本地 READY 替代。只使用自有合成 fixture，不重新消费已退役的 32 条行情事实，不新采集或引入上游运行时/秘密/交易工具；不创建本机 PostgreSQL/Supabase/容器。

功能源码变化后，先撤回受影响的当前 READY，保留历史证据，再从新冻结提交重新完整执行。formalAccepted=false；正式确认遵循 [Codex 拟稿→ProjectUser 一人确认流程](../gate-records/user-acceptance-confirmation-workflow.md)，不能自批。
