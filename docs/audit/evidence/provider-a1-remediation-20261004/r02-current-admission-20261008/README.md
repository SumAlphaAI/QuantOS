# R02 当前开发准入复评证据

当前有效轮次：attempt-05，冻结源码 `7f18b8bc0d90e832b66f3e59652c5b40934c19ac`，14节点/57组全部PASS；C01当前依赖及R02自身严格校验PASS。仅DEVELOPMENT READY，formalAccepted=false。

- [逐项执行台账](./attempt-05/execution-results.json)、[R02严格manifest](./attempt-05/core-r02.json)、[28项台账](./control-matrix.json)、[文档更新后严格内容校验](./strict-validation.json)。调整后开发27/27；原完整范围26/28，C25发布性能和C26部署部分未验。
- attempt-01/e3fbdec：仅完成6组，5 PASS/1 FAIL，剩余51组未完成；F06 Execution连接意外中断，原日志缺阶段，保留UNKNOWN。F09目标通过后，在静态unit阶段主动停止，控制器143，无READY发布。FAIL和提前退出不可合并为有效轮次。
- 首轮收尾：Engine scope无残留；只读Supabase F06 fixture actor/session/secret_ref/events/audits均0。原始失败及两项清理证明保留，未将FAIL改判PASS。
- 79ea170修复：F06逐阶段诊断；仅首次建连已知transport故障最多三次，每次保留证据。权限/TLS/鉴权/取消/SQL执行后不重连、不重放。开发预检33项F06及46项receipt回归PASS，只算预检；当前完整执行57组包含上述回归。
- attempt-02/79ea170：57组完成55PASS/2FAIL，F02 ECONNRESET/旧PASS与R02初始化超时；只读catalog/ledger收尾PASS，未发布READY。
- 80b70e5修复：F02当前失败回执、7事务断言、独立只读收尾；R02准备提前关闭、短清理连接及仅首次建连有界处理。30连接/34F02负向/82严格回执静态PASS，1条件数据库NOT_RUN；实际开发预检与SSL启动器FAIL原件保留，不重标新SHA。
- attempt-03/80b70e5：6组5PASS/1FAIL，F06数据库聚合截止；F09完成后安全停止，actor14停用及Engine无残留。
- 后续F06修复：执行诊断/900秒整组功能预算、SQL前随机fixture登记、独立严格8fixture停用；124负向回归，实际八测试预检与原相对路径启动器FAIL均保留。
- attempt-04/c0c1fe9：完整57组52PASS/5FAIL（F09截止、TP01只读传输超时、R01 SQL连接重置、静态Engine截止、进程收尾发现3）；全部失败与精确收尾保留，未发布READY。F09等待根因UNKNOWN，不把只读1.63秒诊断当成根因或性能PASS。
- 7f18b8b续修：F09有界命令监督、阶段/截止/进程组诊断、SQL前随机fixture注册与独立精确actor停用、不可变事实保留；严格Gate要求所有命令组关闭及完整3fixture收尾。Engine全部五场景保持、独立进程组监督；TP01只读Git超时最多3次，语义/权限/TLS/分支错误不重试。19新增负例、82严格回归、5静态Engine开发预检通过，不重标同SHA验收。
- 当前有效轮次 attempt-05 的真实目标嵌套原件包括Supabase/RLS/Storage、保留行情/研究Python RPC、六文件生产coverage、actor停用与Engine收尾；全部记录原执行源码与时刻。

范围：仅现有Supabase及具名fixture，不创建本地/隔离数据库；无新provider摄取。原1800秒BTCUSDT/ETHUSDT内部用途不扩展，到期不延长。32条旧真实行情明确Degraded、source age按实际记录，Strategy/Trading与不合格Signal拒绝。不可变事实与研究证据对象保留。

C25代表性性能、C26部署HTTP/JWT/候选同SHA hosted CI留Beta；R01 B01/FA-H01、Linux/systemd/主机死亡/长期运行/商用许可仍OPEN/PARTIAL。正式人工确认另拟当前文稿，未自批。最新提交未推送，不能继承8408122的远程结果。

[当前检查报告](../../../R02-current-development-admission-2026-10-09.md)。SHA256SUMS按相对路径校验全部原件，索引不包含自身。
