# PROVIDER:A4 当前功能汇总门禁

仅聚合 C05–C09/C13 共32项当前本机API；三个直接前置 BFF-FE-006/004、PROVIDER:A3 原确认与原回执按原源码/原稿/hash核对，不授予独立新候选READY。原历史文件、失败和中断不重写；本次A4确认PENDING，由项目用户后续确认，不代用户批准。

按最新AGENTS.md执行16组当前功能/必要编译静态/实际影响回归。真实同一BFF实例组合Strategy/Trade两类审批、独立MFA/proof单次消费、幂等丢回复恢复、当前风险/kill/stale拒绝、Paper取消和Order事实、Backtest journal/A3 Artifact/F05根链、混合列表冻结分页、异常租约隔离。冻结分页绑定当前角色和能力集合，任一变化使旧游标失效，不能在策略读取撤权后回放旧策略记录；数据快照冻结不冻结权限。配置策略宿主被隔离时，公共审批列表必须503，不静默输出部分或过时策略审批事实；普通独立执行路径不因此扩大为无关宿主依赖。只有execution权限时不读取未获准的策略事实；只有strategy读取权限或未配置execution宿主时，策略审批列表独立查询，不能为读策略审批被迫获授execution权限。live使用同一checked projection，真实Auth/数据库执行NOT_RUN。

HTTP父探针重新执行execution20、strategy12两个当前源码API探针，绑定实际命令/退出码/时间/子文件hash/source/逐项schema/成功401403以及各1000重试和基本Chromium；不调用子Gate，也不把历史子回执合并为当前PASS。另有新同实例Rust与generated consumer组合证据。两个consumer模块逐文件行>=80%、关键分支100%。真实模块调用和新当前API证据属于本功能汇总，不等于完整业务/UI联调。

默认不递归上游、不做全仓/三轮独立构建/无关十万事件或性能campaign；S01-S04/X01-X05/R01-R02及A3独立Gate不重跑。候选输入按16MiB批次核验所有Git blob与规范要求，原确认也全量分批核对；source/digest/log/命令/API/子证据/覆盖率及runtime/阶段边界变更均拒绝。发布manifest/计划带回滚，并实际激活development/CI/三原确认/直接前置metadata/计划七入口。

显式Paper和Strategy宿主为独立可信输入的进程内租约。页面批准Release不签发TradeCommand；不宣称该Release已通过真实worker/部署安装进执行账户，该完整部署/信号业务链归INTEGRATION。rollback仅请求，不部署；Shadow只读/kill且不dispatch；无venue submit。真实Supabase/Auth/MFA/RLS/Storage、跨实例/重启持久事务恢复、持续feed/许可撤权/密钥/OS隔离、完整P06-P11/P20及G3/G5/FEP3/FEP5链、性能容量长稳/部署/同SHA hosted CI和正式发布均NOT_RUN；保留S02/X01 f64与固定USD/非零异币费用拒绝边界。runtimeAdmission=DENIED，formalAccepted=false，不使用生产凭据或外部发布。

A4_STAGE_GATE仅更新PROVIDER:A4；修改共享源码后组件当前READY撤回NOT_ASSESSED，原确认回执保留原范围。`pnpm check:provider-a4:development`严格验证当前证据；`pnpm check:provider-a4:ci`检查阶段处置，READY时调用同一verifier。UI/staging/正式验收分账，不抬高本机结果用途。
