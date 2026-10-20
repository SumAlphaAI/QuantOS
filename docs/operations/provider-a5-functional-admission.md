# PROVIDER:A5 当前功能汇总准入

按最新AGENTS.md，只执行58个C11/C14/C15/C16当前功能及实际受影响的shared auth/audit/consumer路径，不递归执行四直接前置的Gate、不跑全仓或三轮独立构建。17组检查、一次当前BFF构建；当前为2026-10-20证据目录；四前置绑定各自最新原稿与原回执，10月18日历史不重写。三个API域的HTTP脚本必须在冻结源码上重新实际执行，不复制旧READY。`node scripts/record-provider-a5-functional.mjs`只创建新attempt并保存输入/命令/日志/hash/exit/signal/timeout，原子发布manifest及阶段状态；入口失败回滚，不假成功。停止/失败、旧回执与原用户确认保持。

四直接前置FE:BFF-FE-009/008/010与PROVIDER:A4，核对各自原确认、原完整稿、原源码和回执commit，输入、日志、产物与实际入口hash。只作为referenceOnly/NOT_REVALIDATED，不能重授当前READY。BFF010独立当前Gate因共享源码/工具变化撤回NOT_ASSESSED，原完整稿与确认不改绑。

新增同一Shadow provider组合：真实X01/X05财务版本与immutable report、C15追加账本和差异保持；X06/F09告警ack或observer修复不关闭C15差异，不伪造已对账收益。共享幂等UUID在report/rerun/governance三个路径产生独立回执，精确重试各自一个F05根；治理撤权后所有页面、旧report/rerun请求、下载ticket和stream均以当前权限拒绝。核对source期限、download期限和source quarantine。生成consumer模拟丢回复，以同键恢复服务端事实，不乐观resolve。基本Chromium在三个域实际读取；完整UI不是本次范围。

保留原边界：owner注入Paper/Shadow process lease；治理不写回Supabase/F06成员表；capability只批准已验签审核metadata，不安装/发布Engine；Runbook仅inspect-health/evidence，禁止任意命令、改账与venue submit。X01 f64、USD/simple、覆盖及provisional判断不提高上游保证。C15与X06/F09是显式独立输入，不声称已实现真实跨域告警自动联动。

完整P02/P13/P14/P21/P22/P23、G4/G5/G6/FEP业务联调，实际Supabase/Auth/MFA/RLS/Storage、F05/outbox持久原子性、治理持久写回、多实例/重启恢复、真实feed/observer/Engine、性能/容量/长稳/部署/同SHA hosted CI及正式发布全部NOT_RUN，移交RELEASE-GATE:BETA。当前本A5完整确认稿PENDING，formalAccepted=false、runtimeAdmission=DENIED。仅项目用户确认，不代批准。无生产凭据或外部发布。

本次组合补充两项：301秒后仅更新X06/F09 owner观察，旧治理分页cursor和告警stream仍409，旧报告ticket仍410；新ticket下载同一冻结文稿、同键report仍回原回执，原ledger items不变。共享治理host被quarantine后，所有三个域及已冻结报告/下载/原键恢复均503且无新增F05根。两者为过期与不确定状态语义，不作为性能/持久恢复验收。

门禁强制保存这两项组合测试结果，重新计算log hash不能替代缺失断言。OpenAPI允许兼容1.x minor>=12，58归属、生成物和请求/响应契约仍须精确一致；不固定一个无关补丁版本。四份原确认只绑定已确认源码/输入，本A5新稿仍待用户确认。
