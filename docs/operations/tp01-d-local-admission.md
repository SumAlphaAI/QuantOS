# TP01-D_LOCAL 本地功能准入

本规程只授予 CORE:TP01-D 的 DEVELOPMENT 功能准入。固定必要闭包为 F01–F09、TP01-A/B/C/D、F0、R01、R02，共16节点；执行54组唯一必要本地检查（预检53组加专用门禁负向测试），不得拼接历史消费者回执。仅TP01-D可发布READY，上游15节点只是owner=CORE:TP01-D的LOCAL_READY投影；不授予R1-SERVICE、数据库、外部环境、性能、生产或正式ACCEPTED。

入口（先提交全部源码与规范输入，工作区必须干净）：

```sh
make tp01-d-assess-local
make tp01-d-local-check
# 缺实际目标和正式发布证据时必须拒绝。
make tp01-d-release-check
```

重新执行时使用新的attempt路径：`node scripts/record-tp01-d-local.mjs docs/audit/evidence/provider-a1-remediation-20261004/tp01-d-local-20261012/attempt-02`。禁止覆盖已有attempt/history。记录器在临时目录保存C/D组件原回执和旧本地wrapper，保证F01三次独立构建前工作区干净；成功或失败均将原字节归档到本轮history。失败检查、超时、信号、执行异常及对应日志保留，任何失败均不得发布READY。

门禁按完整40位候选SHA、规范输入、全部16节点文件/日志/支持制品摘要、依赖所有者与索引检查准入；R02合成输入节点不能省略。发布前先完整验证新回执，之后写manifest及两份计划，验证失败恢复旧字节；首次发布失败删除新建manifest。专用负向测试覆盖缺/重复节点、历史C消费者混入、候选/索引/制品摘要替换、R02依赖与目标义务删除、虚报数据库/生产/正式验收、发布回滚和发布阶段拒绝。

功能检查保留20组fixture在Execute/StreamExecute各调用2次，共80次RPC；18类畸形合约须在Artifact/owner/input副作用前由双RPC拒绝；包含审计幂等、稳定Artifact读回、三阶段流式投影及实际Runtime子进程禁止导入vibe_adapter后的研究/取消运行。只使用库存审查允许的workflow_decomposition和streaming_phase_projection两项等价设计，锁定upstream c33133f4fd5e978d21d2a61fdd8787fb352b4687，不应用概念队列为上游补丁。

R01/R02完整本地功能、六项编译变异及真实Engine合成输入消费均必需。InMemoryDataSnapshotCatalog/DataSnapshotRecord只生成自有合成输入，包含质量/hash/租户/时间/用途拒绝；fixture的approved.binance.spot或internal-approved字符串不构成真实来源许可。不消费已退役的32条历史事实，不采集新数据，不升级订阅、不使用生产凭据或外部发布，不建立本机数据库/容器。

14组检查保持NOT_RUN并移交RELEASE-GATE:BETA：f02-database、tp01-baseline、f05-database、f05-volume、storage-database、storage-target、rls-target、f06-target、f07-recovery、f07-coverage、f07-service、f09-target、r01-target、r02-target。移交保留原命令，Supabase容量/默认可写、迁移/RLS/事务/Auth/Storage、持久Artifact/audit/取消与独立进程恢复、实际部署JWT/provider链、GitHub远程治理、OS egress、代表性性能/容量/长稳/平台矩阵、获准来源用途、同SHA hosted CI和ProjectUser发布确认须在测试/发布阶段实际验收。无目标或未执行不得记PASS。TP01-A本地替代显式跳过远程治理并禁用push；公共SCA漏洞库查询仅属依赖安全检查。

源码或规范输入变化后撤回受影响的当前READY，保留历史，再从新冻结提交完整复验。formalAccepted=false；确认遵循[单一用户确认流程](../gate-records/user-acceptance-confirmation-workflow.md)，不得自行批准。
