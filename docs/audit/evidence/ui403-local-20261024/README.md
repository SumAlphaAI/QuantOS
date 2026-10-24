# UI-403 本机功能证据

最终源码 `d3e1a5a8adcab8e1d4d78c73fc1bf31cbd352d8d`，最终attempt-01，工程Gate **PASS_UI403_PERFORMANCE_FUNCTION**；development_status=IMPLEMENTED_PENDING_ACCEPTANCE。复核 `node scripts/ui403-review.mjs --verify`。receipt冻结1621项输入/33个当前产物，并验证304个UI506/P22历史文件原字节未变。

## 已执行

- 单元/组合66/66：UI403新31项、新实际consumer1项、既有C14 provider消费者1项及UI506金融policy33项；新consumer覆盖周/月/季/年×rolling/calendar、C14三投影与C15来源、报告丢响应原键恢复和真实原始报告字节。
- C14 Rust10/10；门禁/静态路由/执行策略58/58；Terminal typecheck、lint、build/client secret scan、计划检查通过。
- Chromium8/8：来源/周期/provisional、queued→文档→JSON下载及detail reload、未知恢复、来源串改/无覆盖、篡改/过期下载拒绝、429、权限/离线和响应式/axe。
- 明暗1440/390四图、四次axe零violations；保留4项color-contrast incomplete（11/19/11/19节点出现，共60次，不是60个独立缺陷）。人工读屏/native200% NOT_RUN。
- INTEGRATION入口预期exit1/STAGE_NOT_READY，159项stage_gate保持NOT_ASSESSED；下一FE:UI-P21开发入口允许。

## 原失败与边界

preflight-01保留类型收窄、无效settings/client导入和unused诊断；首次consumer60通过/1失败，失败源于测试记录的Request body未clone而已被消费。既有C14 provider和UI506回归原通过未改绑。preflight-02为修正后的非冻结65项组合/lint/build/8Chromium预检；新增导航映射单测纳入最终66项，不把旧结果改绑。

实际C01/C14/C15为本机owned X01/C15 reference，身份EXPLICIT_REFERENCE_COOKIE_BRIDGE、CORS LOOPBACK_PROXY_SUBSTITUTION，不是真实IdP/目标持久环境。仅允许POST /v1/performance/reports；下载ticket在网络回执中仅存hash。202仅queued，原键恢复未产生第二份job；报告固定版本/原字节hash大小通过后才触发本机JSON下载。

本机当前支持Shadow/execution.operate、USD/simple/UTC；TWR/MWR/其他币种/策略venue归因/订阅/其他格式不由当前C14提供，不填演示值。P21高保真、真实IdP/Cookie/CORS、Supabase事务/RLS/审计持久化、外部估值/现金流、跨进程重启恢复、目标托管、远程同SHA CI、Firefox/WebKit、人工读屏/native200%、跨OS、性能容量长稳、完整I7/G4/FEP-4/RELEASE全部NOT_RUN。FEP5原C09→C15及C15→C16义务不关闭，旧证据ORIGINAL_SCOPE_ONLY。

stageGate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED；无生产凭据、push、deploy或发布。下一原任务FE:UI-P21。
