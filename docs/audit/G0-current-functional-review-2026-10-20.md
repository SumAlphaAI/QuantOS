# G0 当前功能复核与8项台账同步

冻结源码 `e443495217797c8fe8428620f5177efcf876cf69`；G0工程PASS / DEVELOPMENT BLOCKED；PROVIDER:ALL工程PASS / DEVELOPMENT BLOCKED。原ALL确认已独立保存，不批准新G0。G0待当前范围人工确认，ALL另受G0-L10-2 legacy移除未完成阻塞。

实现8项PENDING→IMPLEMENTED_ENGINEERING映射，保留其他11项/负责人/期限/未来义务；修复旧G0开发入口强制递归上游的行为，新增有界回执、来源与差异核验、独立确认和原子双门禁发布/回滚，CI严格入口保持。两个原测试夹具失效已修复，失败日志保留。生产runtime/API/契约无字节变更；未递归全闭包、未重跑134 API，原历史结果仍绑定原SHA。

实际16组全部PASS，Node 346（157+34+68+87），consumer117/12文件，Web/mockOIDC11例、单次Terminal build、类型/lint/生成/Proto/Linux基线通过。8实际入口中6个exit0、G0严格exit1及ALL严格exit2均预期拒绝。详见[命令](./evidence/g0-local-20261020/commands-and-results.md)、[控制矩阵](./evidence/g0-local-20261020/control-matrix.md)、[差异](./evidence/g0-local-20261020/impact.json)和[新确认稿](./evidence/g0-local-20261020/confirmation-draft.md)。54938原audit/gate中54936文件保持原字节；仅两份当前台账按范围变更且原件已备份，见[历史证明](./evidence/g0-local-20261020/history-preservation.json)。

G0_CURRENT_SCOPE_CONFIRMATION_PENDING；ALL还包含G0_L10_2_LEGACY_REMOVAL_PENDING。四个legacy类仍在API包，现有导入禁令不等同移除。未自批G0或放行页面；formalAccepted=false、runtimeAdmission=DENIED。真实Supabase/Auth/RLS/Storage/持久恢复/外部数据许可/venue、完整业务UI联调、安全/性能/长稳/目标部署/同SHA CI与RELEASE均NOT_RUN；不使用生产凭据、不推送或部署。

下一可执行：用户审阅当前G0完整稿；完成G0-L10-2的legacy fixture迁移/移除及直接相关回归。条件满足后分别执行G0确认门禁与ALL当前评估，再决定I1准入。
