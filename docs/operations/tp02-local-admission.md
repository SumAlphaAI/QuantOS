# TP02_LOCAL 本地功能准入

唯一消费者为 CORE:TP02，直接依赖 F08、F0；必要闭包按依赖后序固定为 F01、F03、F04、F05、F06、F07、F08、F02、F09、TP01-A、TP01-B、F0、TP02，共13节点。完整执行44组唯一本地检查，包含新增TP02专用负向测试；相对2026-10-12预检映射，新增1组负向、远程SCA移交1组，数量仍44。上游12节点仅为owner=CORE:TP02的LOCAL_READY投影，只有TP02可发布DEVELOPMENT READY，不授予R1-SERVICE或其他消费者。

```sh
make tp02-assess-local
make tp02-local-check
# 缺实际目标和正式发布回执时预期拒绝。
make tp02-release-check
```

必须先冻结并提交全部源码/规范输入，工作区干净。重跑使用新的attempt路径，例如 `node scripts/record-tp02-local.mjs docs/audit/evidence/provider-a1-remediation-20261004/tp02-local-20261013/attempt-02`；禁止覆盖旧attempt。记录器仅执行本地策略，剥离数据库/凭据/目标opt-in，离线构建，明确禁用发布性能检查。临时保存canonical组件原件，F01三次独立完整构建前不写工作区；成功或失败均保留本轮生成输出，再恢复canonical原字节，历史失败不覆盖。

准入完整验证13节点、40位同候选SHA、当前规范/文件字节、命令、日志、支撑制品与依赖摘要；不得拼接旧D/R03/A3消费者回执。检查失败/超时/信号/执行异常均拒绝发布。完整准备新wrapper后才写两份计划和manifest；写入或复核失败恢复旧字节，首次失败移除新manifest。专用负向覆盖错消费者/候选/索引、缺/重复闭包、缺F08/F0、缺依赖/日志/命令、异常执行、wheel替换、数据库/生产/正式越权、义务删除及发布回滚。

研究范围仅QuantOS自有fixture-backed provider，两capability、hypothesis_regime_shift/experiment_factor_stability两组fixture各Execute两次、StreamExecute两次（至少8次具名回放，另有五RPC harness）；比较output/input hash、Artifact读回/tenant/owner隔离及幂等，保留取消/deadline拒绝。SDK/RD-Agent wheel实际构建、离线安装到新venv，Python -I从site-packages导入，实际独立UDS子进程完成五RPC并回收；editable或源码import不能替代。没有Microsoft RD-Agent上游运行时、真实LLM/工具、真实DataSnapshot字节解析；snapshotBytesResolved=false、toolsExecuted=false。Runtime测试只用合成catalog/record，不消费已退役32条事实或采集新数据。

13组目标/远程命令保留NOT_RUN并移交测试及RELEASE-GATE:BETA：f05-database、f05-volume、storage-database、storage-target、rls-target、f06-target、f07-recovery、f07-coverage、f07-service、f02-database、f02-sca、f09-target、tp01-baseline。远程SCA查询移交不删除本地secret/license/waiver检查。Supabase可写/迁移/RLS/事务/Auth/Storage、真实持久化/audit/恢复、部署JWT/权限与provider/LLM/tool、真实数据用途、OS egress、远程fork治理/漏洞库查询、P95接收<1s/容量/长稳/平台矩阵和同SHA hosted CI均待实际验收。deadline功能语义仍本地必测，不以性能移交删减。

发布还须实际严格目标回执、同候选完整源码及ProjectUser正式确认。formalAccepted=false；遵循[单一用户确认流程](../gate-records/user-acceptance-confirmation-workflow.md)，Codex不自行批准。不升级订阅、不使用生产凭据、不推送或外部发布、不建立本机数据库/容器。公共输入变化须撤回受影响旧READY并保留历史。
