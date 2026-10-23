# UI-P09 本机功能与高保真证据

最终源码候选 `261f5cbf1430064f0e5f1edf630b4ce0b2abb446`，基线 `5fbe12dde0ef96f2e0a784d9760e4bbe6c95f710`；P09设计稿 `design/P09-TradeProposal-List-and-Detail-High-Fidelity-v1.png`。有界工程Gate：**PASS_P09_REFERENCE_FUNCTION**。最终记录 `attempt-02/`，原始输入/命令/日志/二进制/构建/网络/截图hash见receipt.json；result.json为摘要，`node scripts/ui-p09-review.mjs --verify`可复核。

149项前端/消费者测试；C07宿主20项；C10链/分页直接回归各1项；Node门禁/路由/真实静态宿主21项；Chromium21项（零重试/跳过）。类型/变更范围ESLint/静态构建/client-secrets/计划结构检查通过。12组列表/详情×明暗×1672/1024/390视觉/axe/geometry检查无axe违规；12组规则、120节点incomplete原样保留，未当作通过。

实际reference BFF、本机Chromium、合成身份/数据与明确回环TLS/cookie/CORS替代；功能C01/C07/C10及辅助只读C13。IMPLEMENTED_PENDING_ACCEPTANCE，INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED，I4窗口不自动升级。真实目标/远程CI/性能长稳仍NOT_RUN；未使用生产凭据、推送或部署。

历史：development保留初始类型缩窄错误、SSE夹具缺少必填envelope correlation的FAIL原件和源快照hash；attempt-01保留b6ed39d3的149单元/C07/C10/构建通过、Chromium20/21的FAIL，原因是证据标题未明确“引用”；另有首轮12视觉组原始结果。修正标题并压紧桌面筛选布局后，另起候选261f5cbf及attempt-02。历史全部ORIGINAL_SCOPE_ONLY，未改绑或擦除失败。

完整命令/文件/风险见DELIVERY.md，12图复核与设计差异见VISUAL-REVIEW.md，完整变更见changed-files.txt。delivery-manifest.json校验本目录除自身外全部文件。下一原任务 **FE:UI-503：Trade Ticket preflight**。

首轮Playwright原始error-context/page-state含尾随空白，首次暂存检查exit2日志保留在attempt-01-whitespace-original.log；.gitattributes仅豁免这两个不可变原件及其空白诊断日志，不修改原始字节。
