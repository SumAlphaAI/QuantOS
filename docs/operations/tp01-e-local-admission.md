# TP01-E_LOCAL 本地开发准入

消费者为`CORE:TP01-E`，仅登记本项DEVELOPMENT READY。必要闭包28节点：F01–F09、TP01-A/B/C/D、F0、R01–R04、TP02–TP05、TP08–TP11及R1-SERVICE本地子范围，加上TP01-E。R1-SERVICE与SERVICE:TP01的全局状态不随本入口放行。

`tp01ELocal`继承R1_LOCAL必要检查的本地投影，并增加TP01-E功能回执、功能回执/本地评估边界负向和准入负向。实际Supabase/外部/性能检查必须剔除并完整列入发布移交；依赖证明逐项绑定同一干净冻结提交，不能复用旧SHA执行来冒称新候选复验。

本项验证已有`sync-vibe`实现的S0–S3分级，API破坏、LICENSE/NOTICE与依赖漂移、CVE及patch冲突、diff类别与队列重叠摘要、决策文稿/issue文稿和workflow本地shell语义。六个自有合成场景加六个monitor/严格Gate/无候选/S0保留/坏JSON/旧baseline输入，共12个CLI执行场景；另执行原23项同步回归。阻断场景必须实际退出2，错误输入必须退出1，monitor完成不得批准sync。退出非零原始日志、输入、summary、决策和issue均保留并校验；本地任务READY只表示阻断机制正确，不批准任何candidate采用。

功能生产者为`scripts/tp01-e-functional.mjs`，规范schema为`quantos-tp01-e-functional/v1`。回执含13条实际执行记录、期望退出码、超时/信号/错误码、23项回归计数、冻结输入及所有支持文件hash；拷贝到attempt后校验拷贝原件，不依赖可被重新生成的canonical目录。此功能回执始终stageGate=NOT_ASSESSED、syncApproved=false、formalAccepted=false；只有完整28节点递归证明才可发布本项。

准入入口`scripts/tp01-e-local-gate.mjs`采用事务式写入：先验证完整index、唯一拓扑、直接依赖、同SHA、计划规范、依赖digest与发布移交，再准备manifest/两计划字段；写入或复验失败恢复原manifest及计划字节，首次失败删除新建receipt。不授予其他任务、服务、测试或发布READY，不能替代项目用户正式验收。

从干净冻结提交执行`node scripts/record-tp01-e-local.mjs [fresh-attempt-directory]`。运行器覆盖28节点，逐命令真实执行三次可复现构建、R02合成输入、TP01-C/D、R03/R04及已登记引擎；所有canonical组件输出先备份，保存新原件后恢复旧文件，失败也保留attempt。证据目录必须是`docs/audit/evidence/provider-a1-remediation-20261004/tp01-e-local-YYYYMMDD/attempt-NN`，不得复用已有attempt。

复查用`make tp01-e-local-check`或`node scripts/tp01-e-local-gate.mjs --ready`。`make tp01-e-release-check`在目标/正式确认未执行时必须拒绝。Supabase迁移/RLS/Auth/Storage与持久生命周期、真实来源用途许可、外部GitHub治理、实际上游发现/在线CVE刷新/自然schedule/同SHA CI、实际Git diff/range-diff与候选采用、OS隔离、P95/容量/持续窗口保持NOT_RUN，按计划移交测试/RELEASE-GATE:BETA。合成摘要不是实际Git diff/range-diff或外部目标证据；不联网拉取、不升级订阅、不使用生产凭据、不发布issue/PR/部署。

下一项为TP01-F_LOCAL本地功能整改及29节点准入：真实本机验签、运行中禁用/回滚及在途请求确定性收尾；7天canary和目标环境回滚性能仍由发布验收。

首次完整闭包发现TP09/TP10/TP11开发生产者内嵌线上HTTP检查。所有本地profile现显式选用`--record-local`和独立`*-local-development`制品类型，仍验证固定评估/基线/许可证引用/SBOM/历史CVE材料、合成契约与禁止耦合；线上公共字节/provider条款检查作为external检查移交BETA。LOCAL回执必须声明历史metadata、线上NOT_RUN且currentPublicBytesVerified=false；原`--record`继续是UPSTREAM模式，两种制品不能互相冒充。共22组目标/外部/性能移交，88组必要本地检查数量不变。首轮2505ff8b的82 PASS/6 FAIL和全部生成原件保存，整改须新冻结提交完整重跑。

计划层的`quantos-plan-stages/v1.local_dependency_receipts`同时登记在两计划和中央order policy中；仅允许TP01-E使用指定schema/manifest/三项LOCAL_READY依赖。计划静态形状检查不验证实际执行，完整28节点index仍由专用Gate强制校验。第二轮88/88内容验证PASS但发布因缺此登记被拒并恢复原件；补齐登记及5项计划层准入测试、2项登记撤销/转移负向后须从第三冻结提交完整重跑。
