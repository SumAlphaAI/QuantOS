# TP01-D_LOCAL 本地准入完成报告（2026-10-12）

**TP01-D_LOCAL：DEVELOPMENT READY，工程 PASS；R1-SERVICE：NOT_ASSESSED。** 从干净冻结源码 `4fe846efe3d6187118c82fbffd69ed9bd00bcdac` 完整执行16节点、54/54组必要本地检查，0 FAIL，所有节点绑定同一候选。本轮只发布CORE:TP01-D；上游15节点是owner=CORE:TP01-D的LOCAL_READY投影，不写成全局READY。全图1 READY / 158 NOT_ASSESSED / 0 BLOCKED；formalAccepted=false。

## 变更与准入范围

新增[本地门禁](../../scripts/tp01-d-local-gate.mjs)、[专用负向测试](../../scripts/tp01-d-local-gate.test.mjs)、[记录器](../../scripts/record-tp01-d-local.mjs)及[操作规程](../operations/tp01-d-local-admission.md)。公共receipt策略登记TP01-D_LOCAL，Makefile新增assess/local/release三个入口，两份计划与阶段策略同步登记单一消费者、发布移交和规范范围。预检53组加专用门禁1组，共54组；没有删减基础功能或引入目标数据库命令。

必要闭包按依赖顺序为F01、F02、TP01-A、F03、F04、F05、F06、F07、TP01-B、F08、F09、F0、TP01-C、R01、R02、TP01-D。直接依赖TP01-C/R02/F0均由本候选同一轮完整执行；旧消费者或预检回执不得拼接。新wrapper校验计划规范输入、完整闭包/所有命令/日志/支持制品、同候选和依赖摘要。发布前完整验证，写入或发布后验证失败恢复原字节，首次失败删除新建manifest。

公共输入变化后旧TP01-C_LOCAL已撤回，见[撤回记录](./evidence/tp01-d-local-20261012/revoked-tp01-c.json)。旧C/D canonical在本轮覆盖前归档到[history](./evidence/tp01-d-local-20261012/history/4fe846ef/index.json)，连同旧本地wrapper保留原字节；组件严格依赖仍可为BLOCKED，不能据此把Supabase记作本地故障或把本地READY视为严格目标通过。

## 实际执行与测试

执行器剥离数据库/目标凭据和opt-in，设置QUANTOS_SKIP_ENV=1；pnpm固定10.20.0，实际Engine经本地UDS/loopback运行。无本机数据库/容器。

```sh
node scripts/record-tp01-d-local.mjs
make tp01-d-local-check
node --test scripts/tp01-d-local-gate.test.mjs scripts/tp01-c-local-gate.test.mjs scripts/provider-a1-receipts.test.mjs
make tp01-d-release-check
```

完整[54组执行台账](./evidence/provider-a1-remediation-20261004/tp01-d-local-20261012/attempt-01/execution-results.json)、[16节点索引](./evidence/provider-a1-remediation-20261004/tp01-d-local-20261012/attempt-01/local-prerequisites.json)、[当前专用回执](./evidence/tp01-d-local-20261012/manifest.json)保留实际命令、时间、退出/超时/信号、日志及支持制品摘要。

| 检查 | 本轮结果 |
| --- | --- |
| 三次独立构建 / make lint / make test | PASS；构建摘要一致；Rust356/Python1382/Web229项PASS。Rust已有2 ignored、domain-ui已有3 skipped不计执行通过；数据库提前返回不计数据库验收 |
| TP01-D专用门禁负向 | 40/40 PASS；缺/重复节点、R02依赖缺失、旧C消费者混入、异候选/摘要替换、目标义务删除、越权正式/生产/数据库声明、发布回滚、首次manifest删除、发布拒绝 |
| 收尾D/C/公共receipt测试 | 126/126 PASS，0 skipped |
| TP01-C skeleton / F08 | 五RPC、20回放、100组双RPC边界拒绝、Artifact/取消/幂等、安装wheel及生命周期PASS；完整Python1382、Manager55 PASS；稳定版1项分支负向SKIP，nightly5项实际执行PASS，无新增豁免 |
| TP01-D replay / Runtime | 44 Python PASS；20具名fixture×双RPC各2次=80次实际调用，18类坏合约双RPC拒绝；禁止vibe_adapter导入后2项实际Runtime研究/取消PASS |
| make r01-check / make r02-check | PASS；归一化/去重/原子账本与质量/hash/来源/租户/时间/用途拒绝。R01两项、R02六项实际编译变异均检出 |
| R02 Engine consumers | PASS；2项研究、4项Signal/Proposal/R03引用消费，独立进程组闭合，无orphan/secret泄露 |
| R1回执负向和实际进程探针 | 130/130 PASS，0 skipped |
| 本轮三项owned进程清理 | PASS，discovered=[]、remaining=[]，候选与scope绑定 |
| 计划结构/40项负向/发布移交 | PASS；22后续任务/16检查点，外部环境及性能开发阻塞数为0 |
| 最终证据/保留字节/Git输入/secret扫描 | 13/13 PASS；1272项输入与冻结Git一致，16084份历史证据保留，74份canonical以归档原件核对 |

R02与Runtime研究测试使用自有InMemoryDataSnapshotCatalog/DataSnapshotRecord合成输入；标签approved.binance.spot/internal-approved不授予真实来源许可。未消费已退役的32条事实、未新采集或扩大用途。两项概念patch queue固定上游c33133f4fd5e978d21d2a61fdd8787fb352b4687，仅受控等价设计，没有上游代码导入或队列应用。

## 失败证据与边界

首次收尾final-01因先更新计划中的报告链接、报告尚未落盘而触发broken local link，9组FAIL/4组PASS，原始日志与结果全部保留。补齐报告文件后完整重跑final-02；没有修改冻结源码或规范输入，也没有将首次收尾结果拼接为最终PASS。该收尾装配错误不改变此前54/54源码检查已实际通过的事实。

[冻结前检查](./evidence/tp01-d-local-20261012/before-freeze/results.json)保留未准入exit2和发布exit2的预期拒绝。收尾实际再次拒绝旧C准入、严格D、严格F0及发布Gate；各原始日志、预期退出和执行异常状态见[收尾台账](./evidence/tp01-d-local-20261012/final-02/results.json)。本地成功未改写这些目标/范围拒绝为PASS。

[TP01-D预检首次ENOBUFS失败](./evidence/tp01-d-preflight-20261012/final-01/results.json)、[修复后预检](./TP01-D-local-preflight-2026-10-12.md)、[F0目标HTTP500/只读/调度失败](./evidence/f0-target-diagnostics-20261012/summary.json)与全部历史尝试逐字节保留。旧seal是其历史源码快照，不能用当前修改后的canonical或计划重新冒充旧seal仍对当前HEAD有效；本轮history和新的[封存摘要](./evidence/tp01-d-local-20261012/seal.json)承担当前追溯。

## Gate与风险

14组数据库/目标/远程治理检查保持NOT_RUN并保留原命令，移交RELEASE-GATE:BETA：F02数据库、TP01-A远程治理、F05数据库/容量、Storage数据库/目标、RLS、F06目标、F07恢复/覆盖/服务、F09目标、R01/R02目标。Supabase平台容量/默认可写、迁移/RLS/事务/Auth/Storage、持久Artifact/audit/取消与独立进程恢复、实际部署JWT/provider、真实来源用途、GitHub远程治理、OS egress、代表性性能/容量/长稳/平台矩阵、同SHA hosted CI及ProjectUser正式确认仍须在测试/发布阶段实际执行。

- TP01-D_LOCAL READY仅限本地研究功能；R1-SERVICE、上游独立准入、发布和正式ACCEPTED未授予。
- 合成输入、mock工具/Artifact与进程生命周期不证明持久化、真实provider/LLM/工具或OS隔离。
- 严格目标故障尚未在本轮重测；不宣称Supabase恢复。releaseGate=NOT_ASSESSED，database/external/performance=NOT_RUN，formalAccepted=false。
- 后续公共源码/策略/规范输入变化仍须撤回受影响READY并从新的干净提交完整复验。

未升级订阅、未使用生产凭据、未推送/外部发布，未运行本机PostgreSQL/Supabase/容器或临时数据库。正式确认仍遵循单一ProjectUser流程，不自行批准。

## Git与下一可执行任务

源码及初始证据冻结提交：`4fe846ef`。完整[变更文件](./evidence/tp01-d-local-20261012/changed-files.txt)、[内容核验](./evidence/tp01-d-local-20261012/verification.json)和[seal验证脚本](./evidence/tp01-d-local-20261012/seal-evidence.py)可复核；本轮最终证据另作本地Git提交，在完成回复报告。

下一可执行任务：**TP02本地接口、fixture、安装wheel与必要前置预检，明确TP02_LOCAL单消费者准入范围和本地闭包**。继续刷新R1-SERVICE尚缺组件，最后实施独立聚合门禁；当前TP01-D_LOCAL不能直接放行R1-SERVICE或S01。
