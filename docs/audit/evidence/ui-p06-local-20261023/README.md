# UI-P06 当前页面证据

最终候选以 receipt.json 为准。preflight目录为未冻结工作区的探索与视觉种子，所有失败/输出保留，不作为验收PASS；源码及10张基线提交后，attempt目录不更新快照，独立重放。原UI-301确认与8项incomplete保留原候选，不改绑。

规程见 ../../../operations/ui-p06-strategy-workbench.md，报告见 ../../UI-P06-current-page-review-2026-10-23.md。执行 node scripts/ui-p06-review.mjs --verify 核对当前页面输入与来源、原始日志、截图、axe、快照和边界。当前页面工程通过不等于G3/FEP-3、目标或发布验收；用户确认待定。

预检01：9/12浏览器通过，三个视觉/axe用例发现重复未命名辅助区域；已修复。预检02：P06六项（含18次axe、10张视觉种子）全部通过，UI301五项通过；跨文件缓存使首项UI301未注册共享hook，已改成各文件显式安装hook。全部原始失败与缺失回执保留，不伪造成功证据。无效参数切页签的输入保留与停止保存已验证。
