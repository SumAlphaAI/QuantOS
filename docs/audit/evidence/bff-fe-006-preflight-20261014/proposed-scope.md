# BFF006_LOCAL 本地准入草案（未登记）

本文件定义后续实现范围，不注册Gate、不修改原依赖，不将预检或合成fixture当作完成验收。只消费QuantOS自有合成数据、受控时钟与本机真实模块；不消费已退役历史市场事实，不调用真实venue、LLM或数据源。候选必须先冻结，完整闭包在同一候选重新执行，回执绑定owner/profile、规范计划输入、文件/子模块、日志、产物与递归依赖摘要。

## 两个不同的闭包

- `BFF006_LOCAL`：唯一消费者`FE:BFF-FE-006`，递归64节点；直接依赖BFF003、BFF005、BFF007、X01–X04、TP07、X3-SERVICE及A3。A3已有42节点本地执行策略，新增22节点目前未登记；不得删除S2-SERVICE/TP01服务演进/X3的依赖来缩小闭包。
- `A4_LOCAL`：未来`PROVIDER:A4`聚合递归66节点，还包括`FE:BFF-FE-004`及A4自身。BFF006的完成不授予BFF004或A4，策略/回测/Release API另行实现和复验。

完整拓扑、每节点规范要求、现阶段Gate和缺失映射以本轮`attempt-XX/inventory.json`为机器可读原件。新增22节点为：TP01-E/F/G、SERVICE:TP01、S01、TP06、S02、S03、SERVICE:S04、EVALUATION:TP07/TP12、S2-SERVICE、X01、X02、X03、TP07、X04、TP12、X05、SERVICE:X06、X3-SERVICE、BFF006。

## 接口和fixture

C06/C07/C08/C09已有17个OpenAPI operationId：组合/风险读取、global/account kill switch engage/release、组合stream、Proposal list/get/risk-evaluation/stream、Approval list/get/decide、command-ref submit、Order list/get/cancel-request/stream。静态20组请求/成功JSON样例仅验证契约；3个SSE还需要实际事件序号、断流/重放、gap/retention、授权与取消证据，不能以JSON样例替代。

C13的`getOrderCapabilities`、`getTradePreflight`、`subscribeTradePreflight`仍仅规划，缺路径、schema、生成client、fixture和provider。后续必须落实服务端账户/对象/权限/模式上下文、精度/限额/kill switch/数据时效/策略Release、审批要求和短期引用能力；preflight是预检，不授予成交成功。MFA沿用A2挑战能力但须绑定审批对象、用途、actor、TTL与单次消费，通用登录MFA回执不能自动替代交易审批授权。

本地准入必须证明：合法cookie/资源权限/租户隔离；无前端TradeCommand组装、交易密钥或直连venue；CSRF/origin/body/query/header、统一错误/关联ID、限流和禁止敏感输出；同actor/key/业务意图重放及改变payload冲突；审批过期/自批/重复/数据陈旧/kill switch/Release失效/缺批七类拒绝；1000次并发单次签发和下游提交；202只表示受理，状态由append-only Order/Fill事实和stream驱动；cancel不是乐观成交/撤销成功；故障/重启恢复不得重复副作用。只读接口也须证明读模型重建、stale呈现和服务端拒绝，基本浏览器功能链仍需真实BFF消费者，不能仅测试InMemory backend。

## 前置验收映射

| 前置 | 本地功能范围 | 本轮预检能证明的内容 | 后续准入必须补齐 |
| --- | --- | --- | --- |
| X01 | 1万事件黄金回放、重复/乱序拒绝、可重建Position/P&L/时间 | 运行已有纯领域测试 | 受控读模型服务与BFF消费、同源递归回执 |
| X02 | allow/deny/approval-required各50；kill switch与命中规则/限额/签名；95%规则分支覆盖 | 运行已有150组fixture及规则测试 | 独立95%分支证据、领域输入完整性与受控消费 |
| X03 | 7类拒绝、1000并发单命令、审批单次消费、TTL/审计/幂等 | 运行现有功能测试，跳过混合P95测试 | 拆分该混合测试的TTL/短时签发功能证据；服务端commandRef存取、失效与恢复 |
| TP07 | Paper内核隔离、边界拦截、1000重放单提交、Order/Fill映射 | 运行本机Paper及内存Nautilus outbox模型测试 | 真实独立本机进程传输/重启/错误与权限闭环；内存outbox不是实际Nautilus进程 |
| X04 | 10万合法状态转换、Fill溯源、单次submit、cancel审计 | 运行已有Paper状态机fixture | 业务账本/服务恢复与真实BFF Order消费 |
| X3-SERVICE | S2、TP12、X05、SERVICE:X06及以上全部递归服务功能 | 对账20类差异/受控时间、禁止venue submit与UI fixture冒烟 | 服务组合、受控命令/查询/异常/恢复/证据链；UI fixture不代替SERVICE:X06 |

S2-SERVICE及SERVICE:TP01是必要祖先，目前不能以X01–X04绿色领域测试代替。应先盘点其本地接口、固定baseline/许可和fixture并建立本地策略映射。第三方进程传输、恢复、权限与幂等属于本地功能，不能因真实外部部署移交而删除这些要求。

## 测试/发布移交

Supabase目标写入/迁移/RLS/事务/Auth/Storage/Vault、目标持久恢复、真实Nautilus/venue/provider/市场来源与用途许可、隔离OS/部署/mTLS/远程治理/SCA及同候选hosted CI、真实10交易日Shadow/日终差异、代表性容量/长期运行和所有P95/时间窗性能指标均留测试/RELEASE-GATE:BETA，未执行NOT_RUN；原阈值不降低。本地合成20类差异及受控时钟的语义验证不等于真实15分钟SLA或连续交易日验收。

当前`BFF006_LOCAL=PROPOSED_NOT_REGISTERED`，BFF006/A4/X01–X04/TP07/X3-SERVICE均NOT_ASSESSED；本轮不发布这些Gate，也不自行批准正式ACCEPTED。既有R1/A2/BFF003/BFF005/A3/TP02六项Gate须继续通过当前输入校验，不能由本轮预检改写或撤回。
