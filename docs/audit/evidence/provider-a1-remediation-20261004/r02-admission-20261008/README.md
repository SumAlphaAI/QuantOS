# R02 当前开发准入复评证据

## 首轮：attempt-01（保留失败）

冻结源码`2fd03d803d76cc057b5ce77eb9611d44fbb450fa`，2026-10-08 08:56 CST开始，实际完整56项，54 PASS/2 FAIL：F06启动探针提前超时、F02 Next.js两项新moderate公告。未生成READY。

`execution-results.json`是独立执行台账；logs为日志；supporting保留目标回执、嵌套日志、覆盖和清理。R01 local mock fixture实际Supabase去重/回放/原子异常提交约287ms（≤5s）、四owned actor停用；不是新真实Binance采集。R02复用原批准32条保留事实，两Research真实Python RPC，Degraded/sourceAge335462s，Strategy/Trading与Signal拒绝，Engine停止和owned actor清理通过；不代表新鲜度健康。

补充失败`original-scope-negative.json`为配置只读模拟：同scope ID下延长expiry或扩permissions仍被旧检查允许，原scope/receipt/DB均未改动。`owned-engine-negative.json`保留本轮预提交及完整回归测试的163个Python Engine残留：uv启动器终止后实际Python未退出，按PID/启动时间/完整fixture命令核对后停止，remaining=0。后续修复为直接Python PID/kill_on_drop/实际回收，完整复评增加独立scope socket进程检查；发现残留并清理仍FAIL。

## 修复预检：fix-preflight

未提交源码下的预检，只证明修复回归，不用于准入或同SHA验收。包括106项Node严格artifact/scope/readiness/进程负向与真实子进程探测，直接Python Engine/Research/Signal回归、SCA、受控公开dev/mock构建、类型/格式/计划检查。无DB测试返回NOT_RUN的部分不计数据库验收。首次构建未提供公开profile，触发正确fail-fast；原失败日志保留，之后在受控profile下通过。SCA仍实证验证既有braces/glib backport，未增加豁免。

## 有效轮次

须在提交修复后的干净源码上，以空的新attempt-02执行完整57项、14节点闭包；生成来源/内容绑定的工程DEVELOPMENT回执后，再校验R02自身和当前R01/F06/F0依赖。未完成前不写READY或正式ACCEPTED。C25/C26部署/性能及远程同SHA CI留在Beta，不在本轮重复发布评估。

仅使用既有Supabase，不删除/重建现有事实；原授权1800秒、BTCUSDT/ETHUSDT、内部用途与2026-10-10T00:00:00Z到期保持。没有新真实provider ingestion或自动延长窗口。所有历史失败和metadata留存；本次commit仅本地，不推送。

第二轮`attempt-02`在冻结55b4999完成3项后，因F06只读preflight瞬时PG断开保留FAIL；F09当前目标收尾后停止，全57未执行，owned scope残留0。修复有上限的preflight transport retry后，以新源码/空`attempt-03`复评。嵌套`supporting/r01-target/target`及`supporting/r02-target/target`受全局target/忽略规则影响，提交时须显式`git add -f`本轮这两个证据子树，禁止漏提交actor/coverage/血缘原件。

第三轮`attempt-03`在冻结`73784c75ab01616a7d344e186d0e1247ec9ab929`完整执行57项，56PASS/1FAIL：F07新具名fixture已创建后，Supabase Auth密码登录请求15秒超时，BFF/Runtime尚未启动；原失败回执另存`failed-f07-service/receipt.json`。无READY发布。R01/R02实际目标、覆盖、owned actor/Engine及scope5269c7ba最终进程残留0均通过；不替代F07失败。唯一F07新建actor按源码命名、Auth测试身份、tenant及创建时间窗口独立核对后停用，`actor-retirement.json`保存实际结果，原FAIL不改判。

后续F07修复只对password-token登录传输超时/已知连接关闭最多重试3次，记录每次失败；创建身份、角色/HTTP拒绝、缺token、显式取消和业务断言不重试。新增phase/确切fixture ID，成功失败路径都停用自身actor、核验session retirement及两个本地服务PID回收；清理失败拒绝。控制器保存失败artifact原件，不只有一行错误。

`fix-preflight-f07`为未提交修复源码下的实际Supabase预检：63项针对性Node测试、真实Auth/BFF/Runtime/worker/Storage与六组功能检查通过，自己的actor inactive、foreign fixture session HTTP204、两服务PID回收。`source-state.json`记录实际字节和dirty源码；该预检不计同SHA准入。修复提交后须以空`attempt-04`重新完整57项，不改旧目标源码SHA。
