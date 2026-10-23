# G3-INTEGRATION-01：本地 worker 与因果交接

原 G3/CORE:S04 限定确认仅绑定 9a463495 和 05c427f2，原文、529 文件摘要及校验器见 `docs/audit/evidence/frontend-g3-confirmation-20261023/`。原 incomplete、notRun、additionalNotRun 逐项保留。完整 G3 仍未放行，CORE:S04 仍 NOT_READY，全部阶段门禁不变。

R03 `schedule_strategy_from_research` 只接受同运行时会话、correlation、快照与策略上下文的已完成 ResearchArtifact。它从研究 summary/hypothesis 和父产物哈希构造有界 prompt，拒绝调用者覆盖 prompt；父运行 ID 参与语义输入哈希。普通 research 调度入口拒绝无父策略生成。真实 worker 经过调度、租约、快照门禁、EngineManager 身份握手和 Python UDS 执行，校验输出身份、输入/产物哈希、证据引用及流序列后，写入实际运行时产物、checkpoint 与完成状态。旧 research 输入的无父字段省略编码，保持既有输入哈希语义。

BFF `install_completed_research_strategies` 是编译进普通库的 owner 类型入口，无浏览器 JSON 导入接口。它重新核对完成状态、内核保留 manifest/checkpoint、内容字节哈希、作用域、父任务与真实快照 catalog，并执行 Strategy 快照门禁及生成代码校验。Strategy Lab 的静态检查配套产物按返回字段重构并核验准确 SDK 字节哈希，连同原始 canonical 字节独立保留，拒绝只有哈希外形却无可定位内容的引用。全批通过后才发布 C05 catalog、C04 实际研究运行和原始产物投影；失败不发布，重复批内 run 和已安装 catalog 明确拒绝，竞争安装只有一个成功。该入口是进程内新 catalog 的安装边界，持续运行时增量注册、目标持久事务和崩溃恢复没有执行或准入。

C04 worker Artifact 的 contentHash 与 attachment 字节来自保留的真实产物，不能重算元数据投影哈希冒充源字节哈希。Release 的 evidenceRefs 同时包含研究与策略研究、策略与静态检查三个真实 manifest。每条研究 trace 由 owner 导出 correlation，C05 写入及共享 C08 审批处理器接续前一个事件；请求体/请求头不能指定 trace。节点包含实际对象 ID 和受脱敏策略保护的内容承诺。根节点无自指，读取及幂等重放不得修改已记录的事件。该图是此本机组合的因果证据，不是目标审计存储的密码学签署或全局完整性证明。

验证范围：20 次实际 RD-Agent 研究与 20 次实际 Strategy Lab 延续、20 个独立策略/Release，浏览器经研究详情/Artifact、Lab、静态检查、S02 回测、Release、独立控制会话审批、Paper/Shadow 目标选择和 C10 链；另验证待完成父任务、无父策略、跨关联、prompt 覆盖、作用域/快照/内容伪造、重复/竞争注册、静态拒绝和新 worker 恢复，以及审批拒绝、过期、20 路竞争、只读/离线恢复。自有合成行情、固定 momentum 模板与确定性引擎不能外推为多算法或真实模型验收。测试宿主调用生产 owner 入口，既不导入预生成文件，也不直接构造 StrategyInput 或调用 register_strategy。

直接影响回归为 R03 研究单元/真实引擎组合、BFF C04/C05/C08/C10 及共享执行/审计/身份边界、原 UI301/302/303/P07 页面回归、类型/静态检查与本地构建。原 G3 全仓测试保持原 SHA，不改绑本候选；不因本次补充任务再跑无关全仓、F05/F07 DB/覆盖率 campaign 或上游准入。

执行器：`node scripts/g3-integration-01-review.mjs --run docs/audit/evidence/g3-integration-01-20261023/attempt-NN`。必须先提交冻结源码；每次使用新目录，保存真实退出码、信号、失败和未运行命令，不覆盖历史。`--verify` 核对源输入、二进制/构建摘要、真实 worker 及浏览器数量、原始字节/ID/因果边和阶段拒绝。最终事实以本任务 receipt、审阅报告和待确认文稿为准，状态 IMPLEMENTED_PENDING_ACCEPTANCE。

仍未执行：Research 创建 HTTP→持久 worker 队列、生产或目标部署、真实身份/MFA/cookie/CORS、Supabase/RLS/Storage/跨进程恢复、目标性能/长稳、同 SHA hosted CI、Firefox/WebKit/跨 OS、屏幕阅读器与原生 200% 缩放、Storybook 和正式发布验收。身份与 TLS/CORS 桥及审批控制会话仍是明确 reference 替代。历史全部 NOT_RUN 保持原样；本轮本机 worker PASS 不更新历史回执。完整 G3 阶段准入另行评估，不能由本任务局部工程结果自动放行。
