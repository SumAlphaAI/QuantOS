# TP06 本地开发准入

当前状态：S02共享功能输入已变化，旧TP06独立READY撤回为NOT_ASSESSED；下述32节点/104组为历史profile范围，历史验收原件保留。S02消费者使用新冻结候选完整重跑，不能复用历史结果。

TP06_LOCAL 只登记 CORE:TP06 的 DEVELOPMENT READY。直接依赖完整保留 CORE:F08、SERVICE:TP01、CORE-GATE:R1-SERVICE；展开32节点并对当前冻结源码重新运行必要检查，内部依赖 LOCAL_READY 属于 TP06，不传播独立上游 READY。不得复用旧 S01/SERVICE 结果替代本轮执行。共享功能输入变化后旧 S01 独立准入撤回，历史原件保留。

运行 `make tp06-check` 检查生成/Artifact/Rust消费者/门禁。清洁冻结源码后执行 `make tp06-assess-local`（重试显式传新的 attempt-NN 给 scripts/record-tp06-local.mjs）；记录器移除数据库与外部凭据，保存完整命令、退出码、异常、原始日志、输入hash和递归32节点manifest。三次可复现构建以及共享A–G/R1真实本机模块检查均实际执行。失败和中断必须保留；功能输入变化后重新冻结、完整重跑，不能拼接旧候选通过结果。

自有替换接口与受限DSL见 docs/adr/20261015-tp06-native-strategy-generator.md。生成/check仅存进程内Artifact，read_artifact仅供完成认证的可信宿主调用，参数不是公开读取权限；上游是可替换候选，本轮未联网评估或采用。100个独立语料含大小写、Unicode全角/零宽、空白及中文越权；另有100个替换provider静态失败、Rust实际独立进程消费100失败和清洁回测，以及畸形字段/权限/取消/冲突恢复校验。本地应用能力证明不替代OS网络沙箱。历史TP06候选仅验证notional/universe元数据；当前S02实现已将其接入单标的universe与开仓名义金额约束，范围见S02 ADR。旧TP06独立READY已因共享输入变化撤回，历史证据保留；后续消费者须在新候选完整复验。

共享canonical输出在记录后逐字节恢复，包括原本不存在的目录；失败也恢复。发布自身manifest和两份计划须原子回滚。`make tp06-local-check` 验证当前功能输入与回执，`make tp06-release-check` 对缺真实目标/正式证据拒绝。

TP06_LOCAL 发布移交：继承SERVICE:TP01及R1-SERVICE全部Supabase、部署、真实canary/回滚、外部治理及性能义务；实际Storage/Artifact持久审计、RLS/事务/跨进程恢复、获准live模型与受信任身份、OS出网及凭据隔离、真实目标组合/安全/负载/性能/长稳和候选同SHA hosted CI由测试及RELEASE-GATE:BETA首次发布前实际验收，未执行NOT_RUN。原100恶意提示无订单/secret/network越权、静态失败100%阻断Release、仅Artifact输出和上游完全可替换要求保留；本地READY仅属于TP06，不授予上游、正式ACCEPTED、生产或外部发布授权。

正式确认遵循 docs/gate-records/user-acceptance-confirmation-workflow.md。本轮没有提交或自行批准正式验收；开发准入不以用户签署或目标环境为前置。
