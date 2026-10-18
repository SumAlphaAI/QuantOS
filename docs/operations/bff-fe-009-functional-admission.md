# BFF-FE-009 / A5：C15 当前功能准入

仅实现 C15 七操作：run list/get、break list/get、ledger entries、受控rerun和run stream。真实X05 ReconciliationService核对拥有者注入的不可变观察，owner observe可追加带day的多窗口观察，旧run重跑不得静默切换到另一day；HTTP只允许reason，不接受余额、Book、source、差异关闭或执行payload。X05原生Shadow/tenant/workspace/account/角色/execution.operate授权直接使用，不为页面改写其权限；reference必须显式Shadow上下文，Context同步，Paper/Strategy执行路径在该上下文拒绝。默认live无owner host503，不能回退fixture；注入host在F05持久审计失败后隔离。仅进程内租约，不宣称持久事务恢复。

账本是按run追加的源快照/Fill投影，十进制定点字符串，历史entry字节不改，重复请求不重复追加。run使用真实X05 report hash/input hash与源revision/asOf/期限，仅真实X05 close_day proof匹配该报告且未过期时解除provisional；clean比较结果不等于异常关闭或日终核准。owner关闭证明变化追加journal，陈旧读标provisional、陈旧源新rerun拒绝；原成功键可恢复原答复而不重新执行。If-Match防并发覆盖，独立session/actor/key绑定请求意图，未知字段拒绝。分页绑定当前作用域/角色/能力/查询/session，冻结行且有期限；stream是有界租约journal，支持afterSequence、去重与gap拒绝，撤权/过期重连拒绝。202只表示受理，不允许consumer乐观关闭异常。

差异状态从X05 CAS事实读取；关闭仍要求core已ack、更新且修复的来源、最新核验报告与闭合证据，页面不提供关闭或改账操作。Order/Fill引用标明owner source_record，不能假装为当前BFF可解析订单；Alert为真实X05 exception引用(x05_exception)，C16 Alert API仍属于BFF-FE-010，不虚构其完成。受控重跑的auditRef/correlationId链接当前F05闭链；初始owner observation没有BFF写审计时auditRef=null，不能伪造历史F05事件。

按最新AGENTS.md执行当前功能、X05实际调用边界、共享Context/auth/F05直接回归、生成client/schema/MSW与consumer和基本浏览器；不递归F05/X3/A4等Gate，不重跑无关全仓或三次构建。五前置原回执与源码/hash只作referenceOnly，A4原确认限c9deac5b/5bab5659；新源码后独立A4 READY撤回，原文件与失败不重写。新任务完整稿PENDING，由用户一人确认，Codex不代批。

功能实现、完整联调、发布分别记账。本轮合成Shadow/观察Paper来源不替代真实Supabase/Auth/MFA/RLS/Storage、跨实例/重启恢复、真实feed/许可/撤权、连续10个交易日Shadow、P11/P21/P22/G5/FEP-5、性能/容量/长稳、安全/部署/同SHA hosted CI与正式发布，全部NOT_RUN；目标专用自动化NOT_IMPLEMENTED。继承X01 f64、固定quote和非零异币费用拒绝边界。无生产凭据、无venue submit、无外部发布，runtimeAdmission=DENIED、formalAccepted=false。
