# UI-P21 本机高保真功能证据

当前任务 FE:UI-P21；最终冻结3b0eea66cf9be180dfb90db6d81d4c3740ddd913，attempt-02的55单元/组合、60门禁/路由及14 Chromium通过；工程Gate PASS_UI_P21_CURRENT_PAGE，IMPLEMENTED_PENDING_ACCEPTANCE。执行入口 `node scripts/ui-p21-review.mjs --run <new attempt>`，复核 `node scripts/ui-p21-review.mjs --verify`。生产凭据/推送/发布均不使用。

preflight-01 保留首次SSR缺少React导入的诊断摘录、成功修复后的50项单测/构建，以及3通过3失败的浏览器日志/截图/axe：真实源有3个点而非测试假设2个；面包屑链接缺少非颜色区分；合成fixture多带PerformanceQuery的end字段被严格PerformanceView契约拒绝。以上不是冻结候选通过证据。

preflight-02 为修正后未冻结工作树验证，输出中的基线SHA只标识reference启动环境，不等于这些未提交变更已绑定基线提交。保留每次失败与重试，不将原UI403证据改绑。

实际C01/C14/C15 reference经loopback identity/CORS substitute；rich图形probe为明确合成消费者。INTEGRATION/正式/目标/RELEASE均未自动放行。

preflight-02：51项单测和构建通过；浏览器5通过1失败，窄屏图表容器不可键盘聚焦、版本dd出现滚动截断。补齐tabIndex/region，并让版本完整换行。preflight-03：构建及6项浏览器全部通过，八组布局无页面横溢/axe violations；随后将axe指出的两个generic div aria-label补上group角色（report内容同样修正），最终候选复核不沿用这批未冻结结果。

attempt-01绑定38b76a71，12项命令/53项单元组合/14 Chromium通过；原receipt/result另存original-attempt-01-*，保持原字节，仅ORIGINAL_SCOPE_ONLY。随后审阅发现冻结报告卡片的“当前”措辞与预览刷新后的版本差异提示存在缺陷；preflight-04的新增两项测试确实失败（51通过/2失败），修正生成时标识和从当前report/data动态推导版本差异，最终使用新候选及新attempt，不将原PASS改绑。preflight-02的report/rich截图文件名dark取名时未强制媒体主题，实际可能为系统浅色；最终用例显式设dark，不改动这些原预检图片。

最终attempt-02：12项检查均符合预期，八组页面/四组直接回归axe零violations，保留12条对比度incomplete扫描记录。完整变更清单/命令/限制见 `docs/audit/UI-P21-current-page-review-2026-10-24.md`。159项stage_gate不提升，formalAccepted=false、runtimeAdmission=DENIED；下一原检查点FRONTEND-GATE:G4允许有界功能组合与缺口评估，不代表INTEGRATION准入。
