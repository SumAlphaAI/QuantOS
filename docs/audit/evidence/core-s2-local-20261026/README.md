# CORE-GATE:S2 当前策略业务闭环评估结果

2026-10-26，QuantOS `main`完成当前评估、必要代码/测试/文档和计划同步。实现候选`a104f515`，解释器修复后最终冻结源码`e15cc359b6b8c185cd7c7b6ca9d4c5c4a153b5da`。工程Gate **PASS_OWNED_LOCAL_S2_STRATEGY_LOOP**；完整S2仍 **PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS / NOT_READY_GAPS_OPEN**，INTEGRATION **NOT_ASSESSED**，formalAccepted=false、runtimeAdmission=DENIED。没有生产凭据、数据库连接、外部发布、push或部署。

[18项变更文件](changed-files.md)，[当前规程](../../../operations/core-s2-current-assessment.md)，[主计划](../../../SumAlpha-QuantOS-Development-Plan.md#acceptance-core-gate-s2)。原S2三项完整清单未勾选，正式checkpoint的review_status=NOT_STARTED、source_commit=null不变，历史S2-SERVICE/R1/S04/G3结果不改绑。

## 修复与模块组合

1. HTTP原已拒绝自批，底层Release store/service却允许创建者凭approve capability批准自己的Release。共同approve_bound现在拒绝SelfApprovalForbidden；is_approved也拒绝创建者等于批准者的值。内存与PG共用边界，HTTP映射403。正向fixture改用独立actor，不降低已有权限/hash/expiry断言。旧自批值保持fail-closed，不自动迁移、重批或删除事实。
2. 原生配置消费与去重现在拒绝签发时间在未来的票据，覆盖签发前1纳秒、精确签发边界、单份事实和稳定重放。StrategyService TCP消费新增TICKET_NOT_YET_VALID拒绝并入Audit。PG去重SQL增加请求时间约束及空返回拒绝；**只编译未执行SQL**，实际目标行为仍NOT_RUN。
3. cfg(test)独立Node loopback端口消费同一Web批准Release：原生服务生成本地Paper/Shadow配置票据，GeneratedStrategyAdapter只读取原固定参数、Release hash及报告hash；重复请求保留原票据。普通BFF和浏览器API没有新增部署/配置端点，端口仅在显式QUANTOS_S2_CHAIN下注册，无外部进程/venue/订单部署。
4. TP07/TP12拒绝负向测试的子进程改用sys.executable，实际执行固定Python解释器的拒绝逻辑；不再把系统旧Python缺模块的退出误当成runtime拒绝。

## 最终验证（attempt-02）

| 路径 | 当前结果 |
| --- | --- |
| Strategy领域 | 32通过；静态look-ahead/数据泄漏、不可变证据/参数/源伪造、目标、独立审批、未来票据与真实原生消费。另2项ignored：授权Supabase 1、发布性能1 |
| SERVICE:S04 TCP/UDS | 7/7；102实际生成产物、100未验证/未审批拒绝、100来源伪造、20路CAS、双原生消费者及新增受控时钟回退 |
| Risk消费 | lib 4 + x02_guard 10通过，另1项发布性能ignored |
| Execution消费 | x03_authority 8 + tp07_dispatch 8 + tp12_boundary 1通过；自有Paper/协议边界，无上游运行时 |
| C05/C08与R03 | 24 + 2通过：作用域/权限、自批/expiry、原子注册、来源拒绝、恢复与因果证据 |
| Rust合计 | **96通过、3明确ignored**；PG手工测试仅no-run编译，不计执行通过 |
| Web消费者 | 64/64，5个直接相关文件，含实际参考BFF的Release/独立审批消费及恢复 |
| Python治理负向 | 26通过（另4个subtest），实际runtime拒绝、锁定源/许可证/未知CVE/无耦合规则与注入变异 |
| Node门禁/评价负向 | 223/223，含50项当前S2边界与native消费拒绝检查 |
| S2 Chromium | 26/26：20独立Research→Strategy→Web Release/审批/Audit→双目标原生配置，以及拒绝/过期/20路竞争/只读离线/request_info/未知提交恢复 |
| Release直接回归 | 5/5；共31个Chromium场景，无flaky/跳过 |
| 自动可访问性 | 5次axe扫描violations=0，5条incomplete保留；未记人工通过 |
| 治理与静态 | TP06–TP12七项ADR字节摘要、6项离线评价/依赖排除、TP07/TP12 runtime预期拒绝；lint、Rust格式、宿主/普通BFF编译和计划结构通过 |
| 阶段/下一项 | S2完整INTEGRATION预期退出1/STAGE_NOT_READY；CORE:X06 DEVELOPMENT allowed=true |

[29组实际命令与日志](commands.md)、[逐命令时间/退出/信号/hash](attempt-02/executions.json)、[源码输入](attempt-02/inputs.json)、[严格回执](receipt.json)、[全文件hash](manifest.json)。`node scripts/core-s2-review.mjs --verify`核对主矩阵；`node docs/audit/evidence/core-s2-local-20261026/verify.mjs`同时核对96/3计数、确切未运行项、关键新回归与全部原始文件。源码候选diff检查通过，工具原始诊断字节保留。

20个独立Release各消费Paper与Shadow，共40份原生配置，另校验40次去重重放；20次批准前拒绝以及assisted_live、驳回、到期与request_info均阻断。Research/Strategy是实际RD-Agent/StrategyLab UDS worker，owner安装重新校验源run/Artifact/静态检查/snapshot/hash。使用同一个受信momentum模板与合成行情，不外推20种算法/模型覆盖。Web C10链到审批，配置消费的core Audit原件另存每条s2-native-consumers.json；两套索引尚未贯通为生产持久审计。

Web源码/产品依赖未变，复用S04候选`1f3c8725bbd3f512938add4dab52363c380825d8`的182个导出文件，核对原buildId、输入未变及全部当前字节hash。没有新Web构建，不把旧构建改绑为e15cc359；新Rust与宿主执行绑定当前源码。没有递归上游、全仓、三轮构建或F05/F07 campaign。

## TP06–TP12决策边界

七项ADR与hash见[governance](attempt-02/governance.log)。TP06继续QuantOS原生StrategyLab，不导入外部vibetrading；TP07/TP12只消费固定评价资料与规则，runtime入口明确拒绝；TP08 Qlib、TP09 TrendRadar、TP10 ValueCell、TP11 OpenStock保持reference/evaluation边界，当前workspace检查不允许其生产依赖。未安装、构建或执行这些上游，没有新增adoption。历史漏洞结果/未知项按原日期保留；没有查询最新CVE、重做法律/数据用途许可或授予供应链、运行时、发布READY。离线工程验证不能代替这些义务。

## 原始失败与未决项

- preflight-01：两项新增回归在修复前均失败，分别证明领域API自批和签发前消费可被接受；原始失败保留。
- preflight-02：修复后非提升沙箱中7领域项通过、UDS producer启动失败1项；仅为未提交探测。最终有本机端口权限的实际102产物/消费者验证另有当前结果。
- preflight-03：新增宿主Audit读取曾用错Page字段类型/遗漏字段，原编译诊断保留，修复后编译。
- preflight-04：未提交探测的同源双配置与过期两场景通过，不能依日志baseline SHA改记为冻结候选验收。
- attempt-01（a104f515）：已执行业务与离线检查通过，Python 24通过/2失败；子进程误用不含tomllib的系统python3。失败原件与后9项NOT_RUN保留，没有拼接PASS。最终attempt-02使用同一测试解释器，保留真正拒绝语义，全部按本轮命令预期完成。

显式替代仍有reference身份/Cookie/TLS/CORS/MFA、内存C04/C05/Artifact/Audit、测试宿主启动R03和fresh-catalog owner安装、Node-only配置消费桥。生产HTTP→持久队列与增量目录、真实身份/授权、持久Storage/Audit、Web C10与native消费审计贯通、跨进程恢复及完整业务联调待补。旧自批目标记录的清查/治理未执行，不能继续将其视为有效审批。

实际Supabase/RLS/SQL/目标事务、外部来源与用途许可、最新供应链/法律复核、全浏览器/跨OS、人工可访问性、目标部署/安全/回滚、性能/长稳、同SHA远程CI与发布均NOT_RUN。当前部分本机组合不构成正式ACCEPTED、阶段READY或运行许可。

下一可执行原任务：**CORE:X06 执行/审计/运维Terminal页面（DEVELOPMENT）**，按当前功能与实际影响验证，完整S2的缺口继续在原范围维护。
