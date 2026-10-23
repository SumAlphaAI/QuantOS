# UI-P04 本机当前页面证据（2026-10-23）

工程1fb76f8667bb5e17b50ab8f4573f7eb7ef9d9403；617输入/58产物/10命令，119单测、14Chromium、77门禁/路由，types/lint/build通过；12回归基线比较/12截图/12axe零violations，本轮12条color-contrast incomplete（76个跨扫描节点出现次数，未去重）保留，未关闭原6+2+P03十二条记录。

- [回执](./receipt.json)、[范围](./scope.json)、[原始命令](./attempt-01/executions.json)、[视觉核对](./visual-review.json)、[完整确认稿PENDING](./confirmation-draft.md)、[完整报告](../../UI-P04-current-page-review-2026-10-23.md)。
- preflight-01：119单测和lint通过；typecheck失败，Research runtime未暴露assertCurrent。通过页面传入原route-access检查修正，无runtime变化。
- preflight-02：types/lint/build通过，浏览器未开始，沙箱监听3190 EPERM原日志保留。
- preflight-03：授权本机loopback监听后14/14，初建12截图基线；12contrast incomplete加Research六次aria-prohibited-attr incomplete。metrics加group后最终无语义规则incomplete。截图和原始报告不改写。
- preflight-04：types/lint/67门禁/计划通过；preflight-05：77门禁/lint通过，新增axe范围/节点/历史保留及语义问题拒绝检查。
- attempt-01：唯一最终冻结工程，10命令均预期结果，最终不含update-snapshots。预检SHA启动标签be2b2332对应未提交诊断源码，不算基线工程验收，也不与最终候选拼接。

原UI-202/203证据包和确认逐字节复用；原245Rust输入与e3776999 reference二进制不重建。原input、确认、incomplete与NOT_RUN不重绑当前SHA。冻结工程后仅生成scope/draft/report/manifest索引，不重新运行原业务全链。

现有身份cookie桥/CORS loopback/自签TLS、3190/4010和动态reference端口、本机referenceArtifact的synthetic性质、状态与关系合成覆盖、非真实engine完成全部保留。浏览器只显式取消C03，种子由Node控制，读取可追加审计事实。归档JSON不自动重放，不执行内容中的HTML/URL。SSE最后确认sequence与终态仍来自原runtime。

人工确认PENDING，159stage_gate NOT_ASSESSED，G1/FEP-1 NOT_READY_GAPS_OPEN，G2/FEP-2未评估；formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。保留Firefox/WebKit阻塞及全部NOT_RUN。下一原任务FRONTEND-GATE:G2范围核对，无G1辅助项开发前置；未使用生产凭据、推送或部署。

当前本轮基线由新页面建立，局部遮罩随机引用、UTC与hash，0.5%像素差阈值只防回归，不证明设计PNG逐像素一致。Codex查看原图及四张最终桌面/小屏截图；独立人工、读屏、原生200%缩放、跨OS均NOT_RUN。
