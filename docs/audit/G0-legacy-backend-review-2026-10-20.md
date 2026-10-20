# G0 确认收口与 legacy backend 迁移/移除

原G0用户确认已保存并在f7141e4b收口原e4434952范围DEVELOPMENT READY。当前迁移冻结 `4fdc67b41b1cf30215ca96a0ac2fe97d6729dc83`，1652输入；G0-L10-2工程完成，当前G0/ALL工程PASS，DEVELOPMENT BLOCKED仅剩迁移后G0范围确认。

四类生产backend、四个旧Backend接口及旧客户端运行时构造器已移除；生产四模块仅类型，JS产物只有注释与空export。45个原UI兼容类型主体保持，场景状态和组装仅在tests/fixtures，经生成operation metadata/Zod/生产transport无网络adapter核验。原29项拥有域场景保留，新增6项adapter测试；仅UI fixture，不作为真实BFF、交易authority或目标性能证据。其他18项台账、负责人/期限保持；历史整项不CLOSED。

实际16组通过，Node323（177+59+87），consumer177 PASS/3 SKIPPED/23文件，Web/mock OIDC11例，API client/Terminal各一次构建；8入口6个exit0、G0严格exit1/ALL严格exit2预期拒绝。[命令与结果](./evidence/g0-legacy-local-20261020/commands-and-results.md)、[控制矩阵](./evidence/g0-legacy-local-20261020/control-matrix.md)、[差异证明](./evidence/g0-legacy-local-20261020/impact.json)、[确认稿](./evidence/g0-legacy-local-20261020/confirmation-draft.md)。首轮1833d223误拒绝编译注释FAIL已保留；修复AST检查后在新候选独立执行，不拼接首轮局部PASS。3个skip是未启用的TP03/04/05外部Engine响应桥，未记通过。

基线f7141e4b的55020原audit/gate文件中55017份原字节未变；仅当前台账JSON/Markdown与当前范围确认登记三份按流程版本变化，原件预存。原G0/ALL稿、用户答复、工程回执与日志均保持。[历史核证](./evidence/g0-legacy-local-20261020/history-preservation.json)和[类型核证](./evidence/g0-legacy-local-20261020/type-preservation.json)。原API134操作/Rust/HTTP证据只按原SHA引用；OpenAPI/generated/provider/原生源码未变，无关全闭包、三次构建、全平台矩阵未执行。

原范围批准不改绑至新功能输入；按确认规程第5步，新稿PENDING。当前旧legacy阻塞已消除，但G0_CURRENT_SCOPE_CONFIRMATION_PENDING仍在；formalAccepted=false、runtime/page DENIED。真实数据库/Auth/RLS/Storage/持久恢复/数据许可/venue、完整业务/UI联调、目标安全/性能/长稳/部署/同SHA CI及RELEASE仍NOT_RUN。不使用生产凭据、不推送或部署。

下一可执行：确认迁移后G0完整稿，按同一工程输入执行`pnpm finalize:g0-development`核验当前G0与ALL严格READY入口；通过后再按计划核验I1任务前提。
