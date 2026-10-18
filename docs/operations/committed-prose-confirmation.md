# 已提交纯文稿的显式用户确认兼容

依据用户2026-10-18直接确认BFF-FE-001完整确认稿的指令，记录原始答复、原稿/范围摘要和不可变Git文稿；原稿保持字节不变，不把原稿当时的PENDING改写为确认事实。确认状态由独立`quantos-user-acceptance-confirmation/v1`记录表达，绑定原85530021功能输入、4f261e67原文稿与技术回执。

原稿没有JSON request块。`validateCommittedProseConfirmation`显式兼容已提交纯文稿，验证用户身份/时间/原始答复/明确文稿引用、文稿摘要与Git原件、限定request、原技术回执及修改前有效门禁；仅允许DEVELOPMENT FUNCTION_ONLY，formalAccepted=false、releaseAccepted=false、runtimeAdmission=DENIED。默认`validateUserConfirmation`仍强制JSON request，RELEASE不能进入此兼容路径；原工作流与历史签署不改写。

执行`node scripts/bff-fe-001-confirmation.mjs`复核本次实际确认；36项确认负向/格式兼容用例覆盖默认严格路径和当前原始用户答复。用户仅确认原稿明确功能范围，不把NOT_RUN变为PASS、不重授上游或新HEAD的READY，不放行目标Supabase/IdP/完整联调/发布。后续新任务须另拟范围完整文稿。
