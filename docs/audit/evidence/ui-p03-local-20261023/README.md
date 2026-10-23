# UI-P03 当前页面证据索引

最终通过仅由 receipt.json 指向的冻结源码与新 attempt 证明；失败轮次、预检或旧任务结果不拼接为当前候选 PASS。

- preflight-01：78 单测、类型、lint、初始 build 与52项门禁/路由通过。仅未提交工作区诊断。
- preflight-02：11个Chromium中8个通过、3个失败；测试仍查完整ID文本而页面已改为缩写、关闭modal取消后的焦点未恢复、浅色主按钮对比度违规。完整原失败上下文、axe violations/incomplete、截图与网络记录保留。修复为验证title中的完整ID、先关闭原生dialog再恢复焦点、浅色按钮白色文字；未降低axe规则。
- preflight-03：修正后lint/build和门禁/路由通过；preflight-04为11/11并建立两主题×两路由×三宽度12张截图基线。基线创建不等同正式比对。
- attempt-01：冻结工程 a99c57fc1c7039f6300d25b35eee9bc757e50ab8；78单测、types/lint/build通过，浏览器9/11，两个视觉场景因随机关联ID影响自动表格列宽而失败。保存expected/actual/diff与原始source输入、执行记录；无通过回执。未放宽0.005比对阈值。
- preflight-05：修复为固定列宽与引用等宽字体后的构建；preflight-06重建当前任务未确认基线，11/11。测试重置鼠标/横向滚动，遮罩仅随机引用、服务端时间、表单deadline等变化内容，未遮罩布局/质量结论/错误/提交动作。原a99c57fc基线版本仍保存在Git，原差异图不改写。

- attempt-02：冻结工程93fa8bc8854640dcf2a3e10555587cd53c655888，78单测/types/lint/build通过，10/11 Chromium；浅色390创建截图因时间窗文本换行改变面板高度及居中定位失败。原截图expected/actual/diff和axe保留。后续固定时间窗两行等宽显示（原始RFC3339数据不变），移动端按面板起点显式定位，不放宽阈值。
- preflight-07为该修复后的构建，preflight-08只建立两项视觉场景的12张修正基线，不冒充全业务通过；preflight-09在新随机ID/时间下不更新基线独立比对2/2通过。

预检 sourceCommit/buildId 是执行时环境标签（840c90d2、a99c57fc或93fa8bc8），发生在未提交工作区，仅作诊断，不代表该SHA已包含后续改动或验收通过。最终源版本由receipt的input清单逐字节与Git核对。

复用UI-201原工程e3776999、原文稿证据89da61ee及确认840c90d2，原541输入/44产物/122单测/24Rust/8Chromium/52门禁仅原范围引用。245项Rust输入及原runtime/policy/gateway全部不变，reference二进制原字节复用，不重建、不重跑Rust或上游全链。原6项图标、2项表头incomplete及历史NOT_RUN逐项保留；本轮新axe结果独立记账，不覆盖历史报告。

原始成功/失败产物与输入摘要见各attempt及最终receipt/manifest；确认稿PENDING、159阶段Gate不提升。未使用生产凭据、不推送、不部署。

attempt-03工程418e3fdcc071d085689af694833c030f49c6dbfb已通过全部当前页面检查，原通过回执/范围/视觉核对/待确认稿保存在 prior-418e3fdc/，仍绑定该SHA，不改绑为后续候选。最终目视发现窄操作列的“审计”折行，preflight-10构建及preflight-11两项视觉通过后仅收紧该列内边距/引用字体；保留0.005阈值，12张既有基线无需改写（变化在阈值内）。该排版修正另冻结新源码与attempt，不把418e3fdc的通过冒充后续源码验收。

attempt-04工程ec3f779705ea1b74007deaf069f1c9d12d720dc6，业务/类型/静态/构建通过，Chromium10/11；深色390创建截图产生约18px整体滚动偏移，保留expected/actual/diff。修复截图工具为按main/panel几何边界定位，并在axe后再对齐、记录beforeAxe/afterAxe/capturePosition；不以工具假定代替证据。preflight-12新随机数据下2/2不更新基线通过，该轮实测axe前后位置一致、截图面板顶部与main顶部误差小于1px。没有声称axe一定是原偏移根因。产品功能逻辑不因截图工具修复改变，原失败不改写。

最终工程9d8de103a61531588ebc4888af87b0d2ec6be89d/attempt-05：78单测、11 Chromium、12张截图比对、12次axe零violations、52项门禁/路由、types/lint/build通过；10条执行的命令、562输入与54产物绑定本工程。12条当前color-contrast incomplete扫描记录独立保留（重复控件，不等于12个独立缺陷）；原6图标及2表头incomplete、Firefox/WebKit阻塞与全部NOT_RUN未关闭。13份生成失败上下文/页面文本只加精确路径whitespace属性，保留原始字节。当前页面工程通过、人工确认PENDING，不提升159阶段Gate或G1/FEP-1联调/发布状态；下一原任务UI-202开发允许。
