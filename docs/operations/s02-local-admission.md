# S02 本地开发准入

S02_LOCAL 只发布 CORE:S02 的 DEVELOPMENT READY。直接依赖保留 CORE:S01、CORE:TP06、CORE:TP08、CORE-GATE:R1-SERVICE；新冻结候选展开34节点，111组全部重新执行。历史 S01/TP06/TP08/R1 结果不能代替本轮。完整依赖的108组显式检查先于S02自身3组完成（公共 make test 同时检验全工程代码），全部绑定同一源码/功能输入。本轮不发布上游独立 READY；共享输入变化已撤回旧 TP06 准入，历史原件保留。

预检：`QUANTOS_SKIP_ENV=1 make s02-check`。清洁提交全部功能输入后，`QUANTOS_SKIP_ENV=1 make s02-assess-local`；受控中断须保存缓冲原始日志并按备份恢复，不能直接丢弃进程输出。失败重跑须给 `scripts/record-s02-local.mjs` 传全新 attempt-NN。实际执行三次可复现构建、make lint/test 和所有必要节点检查。记录器剥离数据库/外部凭据与 opt-in，设置离线依赖解析和性能开关；使用自有合成数据、受控 clock 与真实本机进程。UDS 与本机测试服务需要正常 IPC 权限；工具链可能校验公开的包管理器元数据，这不是外部业务执行或发布。

来源/成交/成本语义见 `docs/adr/20261015-s02-backtest-provenance.md`。Rust 专项9项含真实 Python 进程、S01 不可变版本绑定和10次重放、100泄漏与100畸形输入拒绝、2个方差溢出拒绝，逐笔成本及终值对账。实际验收报告 JSON 写入专项原始日志，固定当前 Git SHA、本机测试二进制 digest、Cargo/Engine 锁文件及 OS/arch digest；它是本地测试制品，不是部署镜像验收。门禁验证所有专项测试未跳过、实际报告存在且候选一致；递归验证日志/功能制品/输入 hash，拒绝缺节点、混候选、篡改和越权目标声明。

canonical 组件输出先备份，在成功/失败时均逐字节恢复，新增目录恢复为原本不存在；本轮生成字节随 attempt 保存。只在完整复验后事务性发布 S02 manifest 和两份计划，任何写入/后验证失败均回滚。`make s02-local-check` 校验当前输入和已发布回执，`make s02-release-check` 对缺真实发布/正式验收证据应拒绝。

S02_LOCAL 发布移交：继承S01、TP06、TP08及R1-SERVICE全部Supabase、外部来源/模型授权、部署、真实canary/回滚和性能义务；实际持久Snapshot/Artifact字节、RLS/事务/跨进程恢复、真实模块消费与成本校准、代表性负载/性能/长稳、安全和候选同SHA hosted CI由测试及RELEASE-GATE:BETA首次发布前实际验收，未执行NOT_RUN。保留同候选10次一致重放、100个look-ahead/泄漏全拒绝及成本/环境/输入hash要求。本地DEVELOPMENT READY仅属于S02，不授予上游、正式ACCEPTED、生产或外部发布授权。
正式确认遵循 `docs/gate-records/user-acceptance-confirmation-workflow.md`，由 Codex 提交具体文稿后项目用户一人确认；本轮不自行批准，也不把用户确认或目标环境设为本地开发前置。
