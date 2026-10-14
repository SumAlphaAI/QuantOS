# S2-SERVICE 本地预检与后续准入范围

本轮完成接口、fixture、必要前置和验收映射预检，不登记新 Gate。根闭包39节点，SERVICE:TP01子闭包31节点；详细拓扑、规范输入、检查生产者、来源和待补项见 `mapping.json`。27个已映射节点沿用 R1_LOCAL 的必要范围，12个新增节点只有提议映射。计划原文和全局阶段状态保持不变。

## 本地准入提议

| 子范围 | 本地必须证明 | 专用回执和消费关系 |
| --- | --- | --- |
| TP01-E/F/G | S0–S3阻断与失败原件；签名拒绝、flag/影子/告警、真实本机禁用回滚及在途请求收尾；20 workflow协议替换 | 各自产生严格 `*_LOCAL` 回执，SERVICE:TP01消费 |
| SERVICE:TP01 | 31节点闭包、三次可复现构建、20组双RPC回放、≥100负向、受控取消≤2秒、Artifact去重、E/F/G消费 | `TP01_SERVICE_LOCAL`，被TP06和S2消费；不授予CORE:TP01 Web E2E或正式ACCEPTED |
| S01 | 50组并发编辑无静默覆盖、授权/已批准Snapshot/Artifact、验证发起约束 | `S01_LOCAL`，S02和SERVICE:S04消费 |
| TP06 | 100恶意提示拒绝、Artifact唯一输出、静态失败阻断、可替换、真实本机UDS桥接 | `TP06_LOCAL`，生成输入被S02消费；fixture生成器不等于真实LLM |
| S02 | 10次重放一致、100泄漏拒绝、成本/环境/输入hash、消费生成草稿 | `S02_LOCAL`，S03和SERVICE:S04消费 |
| S03 | 验证/审批拒绝、Paper/Shadow目标、不可变hash与冲突 | `S03_LOCAL`，SERVICE:S04消费；不从布尔/hash占位值推定权威服务批准 |
| SERVICE:S04 | 授权目录/Lab/回测/Release API、审批集成、过期/并发拒绝、capability/allowedTargets与审计 | `S04_SERVICE_LOCAL`；必须有真实本机服务成功/拒绝/恢复消费链 |
| EVALUATION:TP07/TP12 | 固定版本/许可证/供应链材料与能力清单；ADR、威胁模型、接口差异、≥5禁止耦合规则、无运行时依赖 | `TP07_EVALUATION_LOCAL` → `TP12_EVALUATION_LOCAL`；缺供应链文件必须明确处置，不以ADR替代 |
| S2-SERVICE | 39节点严格闭包及草稿→生成→回测→Release→审批消费链，评估归档 | `S2_SERVICE_LOCAL`，全部必要本地回执完成后再实现/运行admission |

每份后续回执应绑定干净冻结提交、完整输入清单、计划规范、实际命令/退出码/超时/信号、测试计数、原始日志hash和消费证据。失败不能通过expectedExit转换为准入成功；本预检的退出2只表示成功捕获仍开放的本地缺口。旧回执只作历史或经输入逐字校验的证明，不能混称新提交完整执行。

## 本轮接口与fixture边界

已有 `quantos-strategy` 进程内草稿/回测/Release API，Python StrategyLab五RPC和Rust Manager桥接。C05发布了11个策略BFF操作、4个请求和11个响应示例，另有1个计划SSE操作；这些是SERVICE:S04的后续消费者接口预检，BFF-FE-004本身不属于本次39节点闭包。实际reference provider探针只连接127.0.0.1，独立session控制须200，并保存业务路由404与鉴权/输入守卫结果。守卫通过不等于业务handler完成；将来可先提供专用策略服务而不提前关闭BFF任务。

fixture全部为QuantOS自有合成输入，不使用已退役R02市场事实。TP01 healthy-7d/rollback-drill JSON只测试状态机，不能证明经过7天或真实5分钟回滚。`signedArtifactsPresent`、`runtimeIsolationVerified`布尔值不能替代验签/隔离和运行中回滚证明。S01 P95测试忽略属于发布移交，不影响功能用例计数。

## 前置复用与移交

本轮从新冻结预检提交执行聚焦检查，并严格重验 `5e14e3a4` 的R1_LOCAL 27节点/85组原执行证据及当前输入一致性；不称为新SHA完整重跑85组，不发布R1阶段。三次构建、R02合成授权输入、TP01-C/D、TP02–TP05、TP08–TP11、R03/R04由该严格证明覆盖。27节点证明及其历史失败原件保持不变。

实际Supabase执行、迁移/RLS/持久化/Storage目标验收，外部环境、供应链在线刷新/CI、真实canary持续窗口、P95/容量/目标环境回滚性能均 `NOT_RUN`，移交INTEGRATION测试或RELEASE-GATE:BETA/LIVE-READINESS。受控取消、TTL、过期拒绝和并发冲突是本地安全功能，仍须测试。依赖引入的许可证和固定供应链评估材料不能当作性能延期而免除。P06/P07页面、20 UI fixture及S2业务联调在CORE:S04/G3，完整浏览器发布矩阵在BETA；不在本服务预检授予。

不升级订阅，不连接生产或目标数据库，不执行外部发布。正式验收仍须项目用户确认规定范围，本轮不请求或代行正式批准。
