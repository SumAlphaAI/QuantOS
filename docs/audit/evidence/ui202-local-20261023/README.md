# UI-202 当前功能原始证据（2026-10-23）

范围：I2 UI-202 Research详情、SSE、取消与恢复。仅本机reference C03创建/详情/取消/审计；不申请G1/FEP-1联调或发布准入。所有业务写入仅本机reference进程，Node控制种子与实际浏览器端口逐条标明，身份cookie桥/CORS loopback/自签TLS替代，故障注入另行标明。

历史原字节保留：

- preflight-01：120单测中119通过，重复事件ID的permission_revoked被共享去重规则吞掉。详情专用reducer改为先验证并终止撤权；没有改变共享SSE源码或旧历史结果。另有定时器类型初始化与测试fixture空catch的静态问题，原日志保留。
- preflight-02：120单测及types通过；浏览器测试脚本的多余括号被lint拒绝，修正并单独记录lint-repair.log。随后补充详情no-store和2000事件/最近200记录的边界测试，不拼接为后续源码验收。
- preflight-03：120单测/types/lint/build通过，浏览器0/13：第1场景已完成实际创建、详情和取消，但审计控制查询误用了不存在路径；其余种子因缺少必需X-Request-Id被真实契约422拒绝。补齐夹具请求头与正确evidence-chains路径，不更改owner或降低契约。
- preflight-04：使用preflight-03原构建，只验证已修正夹具/脚本；浏览器11/13。列表尚未增加正确详情入口，以及Next全局route-announcer使未限定main的alert定位冲突，原失败上下文/页面状态/截图保留。4次axe零violations、零新增incomplete。另66项门禁/路由通过；不是最终候选回执。
- preflight-05：增加列表详情入口并将当前页面alert定位限定main，124单测、types/lint、66门禁/路由、计划检查、下一任务开发通过；本任务INTEGRATION按预期拒绝STAGE_NOT_READY。预检中的GITHUB_SHA标签为9688092c但发生于未提交工作区，只作诊断标签，不代表原9688092c包含后续代码。
- attempt-01：冻结工程71e74cc4f7abd068564613606a7d6e672f32c92d，124单测、13Chromium、66门禁/路由、4次axe与types/lint/build通过，原回执保存在prior-71e74cc4/receipt.json。最后核对静态映射允许大写UUID而JSON owner使用小写，追加路由/运行时规范化、单测及实际大写深链场景，另冻结baf91152e556945ca6e83e6a8363980bd46081c9；原通过仅按71e74cc4范围保留。

原UI-P03工程9d8de103、文稿证据6fd794bd、确认9688092c，UI-201工程e3776999及其原证据/确认仅原范围引用。245个Rust输入、原gateway/runtime/policy和共享SSE未变，复用原e3776999二进制，不构建Rust或重跑上游全链；原535个P03证据文件不改写。原6项图标/2项表头/12条P03对比度incomplete及全部历史ledger的BLOCKED/NOT_RUN保留。

当前页面事实以GET读取为准；SSE只记录通知并触发重读，游标仅确认已验证通知。取消202仅受理，未知结果只显式重试原幂等键，离开/失效清理后先读原任务，恢复不重放。合成progress/gap/duplicate、错误资源、success/failure终态和限流/冲突不冒充实际研究引擎的结果。

人工确认PENDING；159阶段Gate保持NOT_ASSESSED，G1/FEP-1 NOT_READY_GAPS_OPEN、formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。G1辅助项无开发前置，下一原任务UI-203。无生产凭据、推送或部署。

最终baf91152/attempt-02通过125单测、13Chromium、66门禁/路由、types/lint/build，579输入/48产物；4截图/4次axe零violations及零新增incomplete。最终仅该同候选回执用于本轮当前功能结论，确认稿PENDING。原始成功/失败/修复与原NOT_RUN不改写。
