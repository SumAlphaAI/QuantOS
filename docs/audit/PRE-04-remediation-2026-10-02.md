# PRE-04 整改与验证记录

> 日期：2026-10-02；范围：一期 Web 接口盘点。
> 基线：`2b6c2cec6b0167d4552a560e4e5ccf27a0eadbe1` 加本次修复；输入文件摘要见[证据清单](./evidence/pre04-remediation-20261002/manifest.json)。
> 结论：**PASS（仓库工程范围）**；原9/9问题关闭，16/16控制点通过，4/4必需产出通过；当前阻塞级/高危/中危/低危均为0。

## 一、逐项整改与关闭

| 原问题 | 修复结果 | 验证依据 |
|---|---|---|
| H-01 字段与权威映射 | 已发布schema属性与inline request独立展开，领域→wire分列；80项映射解析到真实Proto字段；C03成本可选/引用UUID数组、C04来源与秒数、C05 objectVersion、C08 actorId、C10审计/下载/状态、C17设置schema全部对齐。额外识别并修正旧engine version来源，真实字段为engine_version | 字段字典383行；来源解析、渲染一致与回归通过 |
| H-02 语义/源身份漏检 | 受控基线冻结OpenAPI/catalog、Proto和全部JSON Schema身份；字典从真实wire约束和计划决策渲染，不检查来源前缀就放行；manifest精确比operationId/method/path | 字段删除/假来源/类型/required、错误method/path、同数量源替换全部FAIL |
| M-01 P0覆盖与辅助契约 | 补5个官网页，静态/跳转有明确无依赖理由；GS、P02/P03/P04/P05/P07/P09/P10/P11/P15/P18/P19/P22辅助契约补齐并受控 | 23/23单元；删任一官网页或辅助风险/订单/审计依赖拒绝 |
| M-02 Gap状态 | 逐operation对齐catalog；C04附件/C05 backtest stream保持Partial；C17 Web Closed；无published为Open，全部published且无planned才Closed | 8 Closed、2 Partial、7 Open；错误关闭/删除planned operation拒绝 |
| M-03 唯一性 | 构建Map前核对原始ID序列和数量 | 重复C01/GAP-01拒绝，正常17行通过 |
| M-04 任务/页面/owner引用 | 页面源自PRE-01、后端任务解析核心计划、BFF任务匹配catalog及前端计划；角色与领域责任登记受控 | P99/Z99/BFF-FE-999/假owner/已移除任务拒绝 |
| M-05 mock/实现状态 | 依据published、实际fixture和provider/test/历史验收身份生成允许状态；实现依据摘要校验；目标环境固定独立未验收 | C02虚假Implemented、仅生成面虚假Integrated、缺fixture/provider证据均拒绝；未配置MSW仍501 |
| M-06 二期边界 | 一期C17只保留Web P15/P17；原生P16/cache/update/diagnostic单独承接，移除L02充当原生owner的关系 | Web污染负向拒绝；[二期承接](../DESK-PRE-04-interface-transfer.md)保留NOT ACCEPTED与真实任务链接 |
| L-01 当前文档口径 | 台账/Gap/字典/总结升级1.2、2026-10-02；执行计划3.7同步；当前报告增加整改入口，初审原文和证据保留原SHA身份 | 链接/源摘要/生成确定性通过；不把当前结果改写进历史回执 |

逐项关闭记录：[closure.json](./evidence/pre04-remediation-20261002/closure.json)。[初审原文](./PRE-04-comprehensive-review-history-2026-10-02.md)中的50%和9项发现属于修复前状态。

## 二、当前完成率

沿用初审16个等权控制点，不以COMPLETED状态或测试数推算完成度。

| 控制点 | 当前验证 | 结果 |
|---|---|---|
| C01 一期范围 | Web与原生明确分开，独立二期承接 | PASS |
| C02 后端领域与任务 | 原领域任务组均可解析，责任角色受控 | PASS |
| C03 Proto/API资产盘点 | 6/38/15/2/7/50身份受检；服务级、页面BFF、生成与fixture层分开 | PASS |
| C04 契约Q/C/R | 17/17能力及覆盖分类受控，无未决占位符 | PASS |
| C05 Gap准确性 | 62 published/46 planned逐项登记，状态与任务精确一致 | PASS |
| C06 字段已决策 | 已发布字段与计划字段分开；无未决字段 | PASS |
| C07 wire语义 | 名称、类型、required、枚举、格式和嵌套约束忠于OpenAPI | PASS |
| C08 来源/映射 | 80项领域锚可解析，wire源与计划源身份明确 | PASS |
| C09 接口责任人 | 17/17角色登记；真实任务映射受检，签署另记 | PASS |
| C10 mock状态 | 未发布、生成式mock、本地实现证据分开，不允许冒充目标集成 | PASS |
| C11 全P0依赖 | 23/23单元含官网与辅助契约；逐格受控 | PASS |
| C12 序列化/安全原则 | 原精确数值、UTC、受信元数据、幂等/版本/敏感字段规则保留 | PASS |
| C13 生成一致性 | OpenAPI/client/schema/MSW与页面覆盖检查通过 | PASS |
| C14 结构唯一性 | 原始序列精确，重复输入失败关闭 | PASS |
| C15 正负Gate | 32/32回归，初审14类错误输入全部拒绝 | PASS |
| C16 CI/计划/历史 | 接线保留，当前计划结构通过，历史原文摘要验证 | PASS |

严格完成率 **16/16=100%**，PARTIAL/FAIL均0。四项要求产出均通过；383为展开后的契约属性与计划字段行，共享schema摘要另计。此完成率不表示全部108个operation均实现。

## 三、验证与证据

归档基线源码并覆盖修复，临时副本开始无node_modules/构建缓存，冻结离线安装复用宿主下载缓存。21条主检查全部退出0：[commands.json](./evidence/pre04-remediation-20261002/commands.json)。没有Web构建、浏览器或数据库/目标连接。

| 验证组 | 结果 |
|---|---|
| frozen offline安装；workspace lint/typecheck | PASS |
| PRE-04正向/回归 | PASS；32/32 |
| 初审独立探针 | 15/15符合预期：1正常通过、14错误输入全拒绝；初审12类误放行归零 |
| PRE-01正向/回归；计划正向/回归 | PASS；32/32与22/22 |
| BFF OpenAPI/生成/页面覆盖 | PASS；62 operations、51 schemas |
| BFF-FE-000/001/007仓库Gate及负向回归 | PASS；8/8、10/10、11/11；不等于provider目标执行 |
| PRE-06结构与contract fixtures | PASS；13/13 |
| workspace单元测试 | 25个文件，167/167（按本轮各包日志求和；contract的13项另计） |
| 四个PRE-04脚本专项lint | 0错误、0警告；使用Node全局环境，仓库规则保留 |
| 字段渲染确定性 | 与现有产物完全一致，生成不更新受控基线 |

[探针结果](./evidence/pre04-remediation-20261002/probes.json)、[脚本/渲染检查](./evidence/pre04-remediation-20261002/script-check.json)、输入/产物SHA-256均随证据入库。构建未执行，不生成或冒充新PRE-03构建回执；变更脚本后若运行PRE-03仍须按其规则重建。

## 四、后续边界与维护

远端CI、正式G0、指定模型、全量浏览器、完整F03/F06、真实数据库/IdP/对象存储和provider/staging仍 **NOT RUN / NO RECEIPT**。本地参考provider的历史验收文件仅证明其原SHA/范围；本轮校验其身份与源码/测试存在，不重新声称目标通过。

后续46个planned operation继续由BFF-FE任务承接，PRE-04只保证依赖与缺口盘清。本地MSW生成面仍可返回501，不能作为完整成功/错误/陈旧/权限场景验收。

源或决策变化后应显式复核盘点基线、更新字典，再重放正负及关联Gate；`pnpm generate:pre04-fields`只渲染字典，不自动批准新源或状态。发布/阶段放行需取得对应提交的外部回执。

重放脚本：[replay.py](./evidence/pre04-remediation-20261002/replay.py)，归档运行时HEAD并覆盖当前改动，在新临时目录冻结安装与检查；[独立探针](./evidence/pre04-remediation-20261002/probes.mjs)只修改内存。复制证据目录后重放，避免覆盖原始回执；工具链路径及缓存条件已在脚本记录，不创建数据库或部署。
