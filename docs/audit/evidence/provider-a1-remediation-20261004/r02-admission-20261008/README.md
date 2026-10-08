# R02 当前开发准入复评证据

日期：2026-10-08。当前结论 **R02 DEVELOPMENT READY**，最终冻结源码 `5547211a740d2c61d3d2d66d3f44c55c40d68d43`；完整57/57命令组通过，14节点工程READY，formalAccepted=false。当前输入/日志/产物/依赖须严格校验；后续文档提交不冒充发布同SHA或远程CI。

- [逐项控制矩阵](./control-matrix.json)：原C01–C28逐项对照，开发27/27=100%；完整范围26/28=92.86%，C25代表性发布性能和C26部署部分不计PASS。
- [最终执行台账](./attempt-06/execution-results.json)：独立命令、时刻、状态、日志摘要、target与嵌套原件。14份core manifest绑定实际执行源码、当前输入和递归依赖。
- [R02严格manifest](./attempt-06/core-r02.json)、[R01严格manifest](./attempt-06/core-r01.json)、[F06目标](./attempt-06/f06-target.json)、[F0闭包](./attempt-06/core-gate-f0.json)。
- [证据文件摘要索引](./checksums.json)：保留六轮、修复预检、实际目标/覆盖/清理、失败与最终复核日志，不把首轮成功重标为最终轮次。
- [本轮报告](../../../R02-development-admission-2026-10-08.md)及[正式确认待办文稿](../../../../gate-records/R02-development-user-confirmation-draft-2026-10-08.md)。项目用户尚未确认该稿，工程READY不替代人工答复。

## attempt-01：完整失败轮次

冻结源码 `2fd03d803d76cc057b5ce77eb9611d44fbb450fa`，2026-10-08 08:56 CST开始，完整56项54PASS/2FAIL：F06旧启动探针提前超时、F02 Next.js两项新moderate公告。未生成READY。

R01 local mock fixture连接实际Supabase完成去重/回放/原子异常提交约287ms（≤5s），四owned actor停用；不是新真实Binance采集。R02复用原批准32条保留事实，两Research真实Python RPC，Degraded/sourceAge335462s，Strategy/Trading及Signal拒绝，Engine与owned actor清理通过；不代表实时健康。

`original-scope-negative.json`为纯配置只读模拟：旧检查允许同scope ID下延长expiry/扩permissions，原scope/receipt/DB均未修改。`owned-engine-negative.json`保存本任务预检/完整回归产生的163个确属自身的Python fixture残留：uv启动器结束后Python未退出，按PID/启动时间/完整命令核对后停止、remaining=0；历史FAIL保留。

## fix-preflight：修复预检

未提交修复源码下的Node严格artifact/scope/readiness/进程负向及真实子进程探测、Engine/Research/Signal回归、SCA、受控公开dev/mock构建、类型/格式/计划检查，只证明局部修复；不用于准入或同SHA目标验收。无DB早返NOT_RUN不计数据库通过。首个构建未提供公开profile触发正确fail-fast，失败原件保留，后续受控profile通过；既有braces/glib backport实证检查、无新增豁免。

## attempt-02：提前停止的失败轮次

冻结源码 `55b4999a09af2a0e86b73a7e907be1ecf4460da7`，仅完成3项、2PASS/1FAIL。F06只读preflight瞬时“Connection terminated unexpectedly”失败，F09当前目标收尾后SIGTERM停止控制器，全57未执行、退出143；`early-stop.json`、原始日志和`early-stop-processes.json`保留，本scope残留0。没有R01/R02目标或真实provider采集。

随后仅对精确只读transport关闭加入最多3次完整target重试；角色/权限/语义失败不重试，所有失败尝试保留，持久关闭仍FAIL。以新源码、空attempt-03重新完整执行，没有改旧source hash。

## attempt-03：完整失败轮次

冻结源码 `73784c75ab01616a7d344e186d0e1247ec9ab929`，完整57项56PASS/1FAIL。F07密码登录15秒传输超时，BFF/Runtime尚未启动；原失败回执保存在`failed-f07-service/receipt.json`，新建fixture actor经唯一时间/租户/Auth测试身份核对后单独停用，`actor-retirement.json`实际PASS，原FAIL不改判。R01/R02实际目标、覆盖、actor/Engine及scope5269c7ba进程检查均PASS；不因此发布READY。

`fix-preflight-f07`为后续未提交源码的修复预检：63项Node与真实六组功能PASS，fixture actor inactive、separate session HTTP204、两服务PID回收。source-state记录实际修改字节，非同SHA准入。F07修复增加密码-token登录精确传输有界3次/保留各失败，角色/HTTP拒绝/缺token/取消/业务失败不重试；成功失败均核验自己的actor/session/PID收尾，phase与确切fixture身份写入原件，控制器保存失败artifact。

## attempt-04：提前停止的失败轮次

冻结 c8aa8f8，F01 PASS、F06 格式无效bearer返回HTTP503（预期401）FAIL、F09实际目标PASS后停止控制器，退出143，完整57未执行。原件、HTTP trace和本scope3ba7c491进程残留0保留，不登记READY。completed-f09-target同时保存当时artifacts目录的历史子树，历史remote-*回执的原SHA/时刻保留，不能计入本轮或候选同SHACI。

fix-preflight-auth：6项Rust单元与Clippy通过，10类格式无效令牌不产生网络请求，合法格式伪造令牌仍由模拟远端401拒绝；仅局部dirty源码验证，不是数据库验收或准入。随后提交40e11b8，在空目录复评。

## attempt-05：完整失败轮次

冻结40e11b8，完整57项54PASS/3FAIL：F07建连在SQL前关闭、相同业务时间审计顺序反转、R01 poison批量fixture超出30秒租约。F07服务实际六检查及actor/session/PID清理PASS；R02保留来源/两Research/质量拒绝/覆盖与收尾PASS；scope8fbed03c残留0。失败、嵌套原件、覆盖与日志均保留，没有READY。

fix-preflight-db：在原Supabase中执行新的只追加序号迁移；337443条历史审计逐行全部原字段相同，旧序号全部NULL，实际ledger摘要匹配，不回填旧序号。两次迁移前读取超时FAIL独立保留。12项连接bootstrap负向与既有17项服务测试通过，实际同时间取消顺序及R01 fixture目标另留原件；这些dirty源码预检不用于准入。

fix-preflight-r01（初轮）额外verify-full在macOS原生TLS因证书有效期拒绝，尚未进入业务，四actor实际inactive，FAIL保留。Event完整验证统一为Runtime的OpenSSL connector；坏/缺CA和关闭socket拒绝测试通过。受控R01目标明确verify-full，没有关闭证书验证或编辑.env.local；fix-preflight-r01-attempt02保存实际修复回归。原require/prefer已有语义保留，不宣称生产客户端全面强制verify-full。

## attempt-06：最终有效轮次

冻结源码 `5547211a740d2c61d3d2d66d3f44c55c40d68d43`，实际57PASS/0FAIL。包括F01三次独立可复现构建、实际F06/F09、SCA/协议/覆盖、F05万条事件与重复交付、F07实际恢复及本地服务→Supabase、F08实际wheel/UDS，以及当前R01/R02目标和最后scope进程残留检查。

R01为local mock与真实Supabase的功能目标；R02只复用原非fixture保留market来源，明确旧source-age/Degraded与获准Research用途。实际回执包含两Research RPC、来源/reader/wire/租户/质量拒绝、逐文件覆盖及owned actor inactive/EngineStopped。最后独立进程检查discovered=0、remaining=0；发现残留后清理不能将FAIL改PASS。

原批准固定1800秒、BTCUSDT/ETHUSDT、内部工程/研究用途与`2026-10-10T00:00:00Z`到期；当前scope完整匹配原receipt.authorization。没有新真实provider ingestion、自动延长、删除/重建Supabase或交易/展示/再分发/商用扩权。processing/source-age/受控异常提交/自然告警ACK/采样/服务readiness分别解读；历史降级不因pending=0或持续写入消除。

C25/C26发布子项、R01 B01/FA-H01、Linux/systemd、父启动器/主机死亡通知、长稳、商用许可与远程同SHA CI继续待验。全部提交仅本地。

嵌套`supporting/r01-target/target`及`supporting/r02-target/target`受全局`target/`忽略规则影响，本轮提交显式加入并按manifest核对；覆盖、actor与血缘原件不能漏提交。
