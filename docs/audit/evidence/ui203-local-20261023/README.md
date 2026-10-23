# UI-203 当前功能原始证据（2026-10-23）

仅I2 UI-203本机reference当前功能与明示合成边界，不申请G1/FEP-1联调或发布准入。最终工程03ecbdfa31d075a821cabe6e278c65131e25cde9/attempt-01，593输入/46产物/10命令：76单测、12Chromium、67门禁/路由、types/lint/build，4截图/4次axe零violations及零新增incomplete。完整确认稿PENDING。

历史原字节保留：

- preflight-01：74/75单测，发现冷却期重复操作把已有2秒等待重置为默认60秒。修正为不覆盖仍生效retryAt。types/lint通过；首次失败原日志保留。
- preflight-02：75单测、types/lint/build、66门禁/路由通过；浏览器11/12。合成分页游标发往真实reference，被正确422拒绝，不能记作真实分页通过。另4次axe零violations，但各有1条aria-prohibited-attr incomplete：pre带aria-label却缺少有效role。原扫描、页面状态、失败上下文与截图保留；不把它们称为对比度问题。会话中曾误将该规则归为对比度，读取原报告后已纠正，权威以原axe规则ID为准。
- preflight-03：只复测失败的合成分页/保留期场景，1/1通过。浏览器opaque合成cursor仍记录，向上游重读reference时仅去掉合成cursor，保留upstreamQuery并标明SYNTHETIC_C10_PAGING_OR_RETENTION；不声称真实签名游标验证。
- preflight-04：补齐inputHash不可变性验证、预览区region角色，76单测、types/lint、66门禁/路由与计划检查通过；UI-203 INTEGRATION预期STAGE_NOT_READY，UI-P04 development允许。该轮未重跑浏览器/构建，不冒充此轮axe修复验证。
- preflight-05：发现通用artifacts目录忽略规则会遗漏新功能源码，添加仅app/src源码目录的例外，并加追踪输入测试。新67项门禁/路由与门禁脚本lint通过；全部核心源码进入冻结输入清单。
- attempt-01：唯一最终候选03ecbdfa，76单测、12Chromium、67门禁/路由、types/lint/build完整通过；4次axe确认预览角色修正后零violations/incomplete。与预检结果不拼接为候选通过。

预检GITHUB_SHA标签为原e5dcf095，但运行在未提交工作区，仅诊断标签，不代表原e5dcf095已包含UI-203代码。最终buildId、输入及产物完整绑定03ecbdfa。

复用UI-202工程baf91152、原文稿证据ec939e40与确认e5dcf095：原579输入/48产物/125单测/13Chromium/66门禁及243原证据文件按原范围引用，不改绑。245Rust输入、原gateway/runtime/policy/共享SSE未变，原e3776999二进制复用，不重建或重跑Rust/上游全链。原6图标+2表头+P03十二条incomplete及全部BLOCKED/NOT_RUN保留；本轮修正的aria规则不关闭原20条对比度扫描记录。

实际reference Artifact是明确synthetic预置内容；当前浏览器交互GET，server可追加读取审计。关系场景仅Node控制创建reference Research种子；成员、Evidence、错误哈希、缺权限、恶意文本、分页/retention等注入逐条标明合成，不冒充实际引擎输出或真实目标环境。身份cookie桥/CORS loopback/自签TLS均为替代。

人工确认PENDING，159stage_gate仍NOT_ASSESSED；G1/FEP-1 NOT_READY_GAPS_OPEN、formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。下一原任务UI-P04开发允许，无G1辅助项前置。未使用生产凭据，不推送或部署。
