# UI-402 本机功能证据

最终源码 `d41aa2a31b24023470536525c72bc2530512af6b`，最终证据 `attempt-02`，Gate **PASS_UI402_REFERENCE_FUNCTION**，开发状态 `IMPLEMENTED_PENDING_ACCEPTANCE`。`receipt.json` 绑定 1604 项源码输入及 38 项日志/构建/网络/截图文件；复核 `node scripts/ui402-review.mjs --verify`。

## 已执行

- 141/141 单元、真实reference consumer与契约测试，含UI401/UI505/P18/C12直接影响回归；新UI402功能36项，真实consumer1项（2 venue × 7周期 × 2时区）。
- C12 Rust 18/18；静态路由及门禁负向测试33/33；Terminal typecheck、lint、generated同步、当前范围兼容性、build/secret scan、计划检查通过。
- Chromium UI402 7/7，P18图表入口回归1/1；明暗1440/390四截图和axe四扫描均0 violations。
- axe仍有4项color-contrast incomplete（每扫描5个SVG文本节点的待人工核验出现次数），不是完整无障碍通过。人工读屏/native200% NOT_RUN。
- INTEGRATION入口预期exit 1/STAGE_NOT_READY，下一FE:UI-P19开发入口允许；159项stage_gate仍NOT_ASSESSED。

## 保留的失败和范围

- preflight-01：旧schema断言失败与沙箱回环EPERM；build/browser NOT_RUN。旧75a563c兼容性基线88项FAIL与任务前完全一致，见compatibility-parent-comparison.json，不作为本任务PASS；可选productType没有新增破坏性差异。
- preflight-02：97项单元/consumer及build通过；Chromium4通过/3失败（控件可访问名称不精确），原日志未改写。
- attempt-01：绑定a725dc1c，15项命令预期结果均匹配，但封包校验混淆裸hex与sha256前缀而FAIL；没有成功receipt。原文件与packet-verification-failure.json保留，仅ORIGINAL_SCOPE_ONLY。
- attempt-02：修正哈希校验、页面读取序号保护、成对ISO范围和只读权限验证后的新候选，独立执行，不改绑先前PASS。

C01/C12/C09均消费本机reference；身份为EXPLICIT_REFERENCE_COOKIE_BRIDGE，CORS为LOOPBACK_PROXY_SUBSTITUTION。浏览器网络回执沿用ui401.json夹具文件名，实际所有业务请求都是GET；其中C09标记阳性专用用例通过显式标注的合成响应验证，不是实际成交来源。缺product、OWNED_PAPER/mock及维度不匹配订单均不叠加。

真实C09→C12阳性接续NOT_RUN；UI-P19高保真、真实IdP/Cookie/CORS、Supabase/RLS、外部行情/venue/license、Firefox/WebKit、人工读屏/native200%、同SHA远程CI、目标托管、性能长稳、完整I7联调/RELEASE均NOT_RUN。stageGate=NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。无生产凭据、push、deploy或发布。
