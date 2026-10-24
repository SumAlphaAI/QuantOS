# G6 本地有界组合评估证据

状态以 `receipt.json` / `result.json` 和 `node scripts/frontend-g6-review.mjs --verify` 为准；只有冻结候选完整14项命令达到预期退出码才有工程 Gate `PASS_G6_OWNED_LOCAL_COMPOSITION`。正式G6仍 NOT_READY_GAPS_OPEN / IN_REVIEW / NOT_ASSESSED；formalAccepted=false、runtimeAdmission=DENIED。

范围见 `docs/operations/frontend-g6-bounded-composition.md`。同一实际 reference BFF、Paper账户中组合 C01/F06→C16→C11→C10，Operator/Owner/Approver各自独立权限；告警已读、Incident确认、Runbook诊断均不代表源风险解决。主浏览器旅程5根实际审计引用，原请求响应丢失恢复；HTTP组合7根，跨页面撤权与真实409 FEATURE_DISABLED及显式恢复。

生产身份不参与：identity=EXPLICIT_REFERENCE_COOKIE_BRIDGE、cors=LOOPBACK_PROXY_SUBSTITUTION、data=OWNED_SYNTHETIC_REFERENCE_SINGLE_INSTANCE。非JSON403为显式代理交付负向；不能当作实际BFF输出。高级签名/完整历史/成员导出/持续治理流不提供，系统/后台通知未声明。

原生C11 22项为本轮直接正确性范围，不能代替HTTP修复/resolve正向或CORE:X06全闭包。浏览器5项G6组合与17项P23/UI601/UI602直接功能回归，零重试/skip/flaky才通过；跳过未改变布局的截图/合成展示场景，旧完整视觉、axe/incomplete、人工读屏/native200%仅原范围，不改绑。

G4/FEP-4、UI601两项HTTP正向、P13-C11-SERVICE-01及P14四类缺口全部保留；所有159阶段与规范依赖不提升，FEP6里程碑状态不变。历史证据哈希保持不变。实际应用/服务/核心源码未改，未发现本有界组合需修复的产品缺陷；不以错误探针预期虚构产品修复。

真实IdP/Cookie/CORS、Supabase/RLS/事务、外部源/venue、跨进程持久恢复、同SHA远程CI、Firefox/WebKit、性能/容量/长稳、完整I8与RELEASE均NOT_RUN。未使用生产凭据，未推送/部署/发布。下一原任务 FE:FEP-6。

`preflight-unfrozen/` 保留首次错误期望409/403的HTTP探针失败及首次完整UUID按钮定位超时，原始日志/快照/截图不覆盖；其后修正测试的通过只属于非冻结预检。10项拒绝探针首轮已通过，未声称先红后修复。最终以新冻结attempt为准。
