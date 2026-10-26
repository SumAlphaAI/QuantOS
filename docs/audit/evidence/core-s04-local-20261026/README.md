# CORE:S04 当前策略生命周期功能结果

2026-10-26，QuantOS `main`完成代码、定向测试、文档、计划同步和本地原始证据。实现提交`c2bbfa5e4031eb2158485b14ef0171bdd959fda4`，最终冻结候选`1f3c8725bbd3f512938add4dab52363c380825d8`。当前工程Gate **PASS_OWNED_LOCAL_S04_STRATEGY_LIFECYCLE**；完整S04/G3仍 **NOT_READY_GAPS_OPEN**，INTEGRATION保持 **NOT_ASSESSED**，formalAccepted=false、runtimeAdmission=DENIED。未使用生产凭据、数据库或外部发布，没有push或部署。

## 代码与功能

[16项变更文件](changed-files.md)，[当前规程](../../../operations/core-s04-current-function.md)，[主计划](../../../SumAlpha-QuantOS-Development-Plan.md#task-s04)。当前后端已有request_info，但Release消费者schema拒绝该合法动作，导致刷新失败和可读候选/报告丢失。新增确切动作与有界原因字段（与Rust相同的1000 Unicode标量计数），保留原始内容/参数/证据/哈希和核验报告；页面明确呈现补充材料与原因，目标和再次提交保持关闭。与approved/pending状态矛盾的request_info、未知动作和超长原因拒绝。React普通文本显示类似HTML的原因。

测试辅助函数按当前C08契约提交非批准原因；新增真实C08→ReleaseRuntime消费、390宽原因文字、刷新恢复和丢失提交响应后的相同key/body/If-Match重试。首次202丢失后只保留一个approval和一条submitted，不自动换键或授予批准/部署权限。主Playwright入口排除需要专用宿主的S04套件。

## 最终结果（attempt-02）

| 当前检查 | 结果 |
| --- | --- |
| C05/C08 Rust | 24/24：scope/角色/自批拒绝、版本/报告/不可变证据、幂等、TTL及审计 |
| R03 worker/owner注册 | 2/2：实际RD-Agent→StrategyLab UDS、20条来源链、伪造/重复/竞争/静态拒绝和恢复 |
| SERVICE:S04 TCP/UDS | 6/6：102实际生成产物、100未验证/未审批拒绝、100来源伪造、20路CAS、两类本地原生消费者 |
| Web消费者与场景 | 170/170，10个文件；含实际参考BFF消费者、request_info、Unicode原因边界、已有UI301/302/303/P07及模型场景 |
| Node门禁/路由负向 | 90/90，其中新S04范围/回执/重试/浏览器结果拒绝43项 |
| S04 Chromium | 26/26：20条独立研究→策略→Release/审批/Audit旅程、拒绝/过期/20路竞争/只读离线/request_info/未知提交恢复 |
| 直接页面回归 | 20/20；18张明暗/1672/1024/390基线正常比较通过，未提高0.005容差 |
| axe | 37次扫描，自动violations=0；37条incomplete原样保留，未记人工通过 |
| 静态/构建 | 定向lint、Terminal完整类型检查、当前候选一轮Terminal构建和client secret扫描（181文件）通过；全部182导出文件绑定hash |
| 阶段/下一项 | CORE:S04、G3完整INTEGRATION按预期退出1/STAGE_NOT_READY；CORE-GATE:S2 DEVELOPMENT allowed=true |

[全部实际命令](commands.md)、[执行记录](attempt-02/executions.json)、[源码输入](attempt-02/inputs.json)、[严格回执与Web导出清单](receipt.json)、[全证据hash](manifest.json)。复核命令见commands.md；源码候选的diff检查通过，原始工具诊断字节不作空白清洗。Rust有明确筛选的未选项，不记为已运行；最终矩阵无失败、跳过或flaky。未运行全仓、递归上游或F05/F07 campaign，历史全仓/确认仍绑定原SHA。

每条页面链使用cfg(test)宿主实际调度RD-Agent/StrategyLab，不导入预生成输出；受信生产owner类型入口验证源run、Artifact与静态检查canonical字节、snapshot/scope，原子安装新进程catalog。页面核对实际Research Artifact、Lab、S02回测、不可变Release、独立参考actor/MFA审批、Paper/Shadow本页选择和C10因果链。20个独立策略/Release使用同一个受信momentum模板及合成行情，不能称20种算法/模型覆盖。SERVICE:S04测试中的配置票据和原生消费者也仅为本地合成事实，不执行外部部署。

## 失败、基线维护与视觉复核

- `preflight-01/plan.log`：新增证据目录尚未创建导致计划链接校验失败，创建后检查通过；未提交诊断不记验收。
- `attempt-01`（c2bbfa5e）：26个S04、32个Rust、170消费者、90门禁及构建已通过；直接回归1通过/1失败/18未运行，随后四个命令NOT_RUN。失败原始截图、差异、日志和failure.json完整保留，不拼接为整轮PASS。
- 差异来自18张P07矩阵中两张旧1672报告图未同步当前已有导航、百分比近似显示和真实成交bar成本折线。原18图及原SHA/hash完整保存在`visual-baseline-review-01/original`，仅更新两张，另16张未变。生成命令使用update-snapshots属于未提交维护诊断，不是正常比较通过；原因、对照清单及查看范围见[视觉复核](visual-baseline-review-01/README.md)。
- `attempt-02`按新冻结候选和正常比较模式执行，全部18图通过；S04原因截图直接定位时间线，390宽边界通过。Codex查看新原因截图及两张更新报告图，原因/状态/目标可读，未见文字重叠；这不代替跨OS或人工屏幕阅读器验收。

## 未决风险与Gate

显式端口替代仍存在：reference身份cookie、临时自签TLS/CORS、参考MFA/独立控制会话、内存C04/C05/Audit、测试宿主R03调度与fresh-catalog owner安装。生产Research HTTP→持久worker队列、持续增量注册、真实身份/授权、Supabase/RLS/Storage/事务、跨进程恢复尚NOT_RUN；不能把宿主调度称为用户Research页面创建任务的完整生产注册旅程。

完整浏览器/跨OS、37条axe人工判断、屏幕阅读器/原生200%缩放、外部真实数据/用途许可、目标安全/部署/回滚、性能/长稳、同SHA远程CI及发布验收仍NOT_RUN。旧G3的incomplete与所有历史未执行义务继续保留；本轮没有重授G3/S04/S2或其他上游READY，也没有自行签署正式ACCEPTED。主计划保留原IMPLEMENTED_PENDING_ACCEPTANCE流程字段，并另记当前开发完成和工程结论。

下一可执行原任务：**CORE-GATE:S2 当前策略业务闭环评估（DEVELOPMENT）**。完整INTEGRATION继续按原阶段证据评估，不把当前部分本机组合视为全量联调或发布许可。
