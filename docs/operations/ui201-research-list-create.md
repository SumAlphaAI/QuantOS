# UI-201 Research 列表与创建规程

范围：I2 UI-201，`/research`、`/research/new`。复用 UI-204/UI-P05 的 C04 网关、快照策略、快照目录与持续授权失效机制；本页不代替 UI-P03 高保真或 UI-202 详情/SSE/取消。

- C01 session/context 必须身份、tenant/workspace/account、mode、MFA、capabilities 一致；过期取较早值；要求 research.read；写入另需 research.write、snapshot.read、CSRF。当前 reference 身份拥有 C03，但原 C01 漏报两个 research capability，本轮只补齐该身份的声明；其他 reference 身份与 live authorizer 不扩权。
- 列表按服务端 status/dataSnapshotId、createdAt/deadlineAt 排序及 cursor 分页，pageSize 1–200，最多 50 页。新查询清游标；超页、重复 ID、游标环、缺少 items、未知契约均拒绝；410 要求显式刷新。只显示本页数量。
- 创建固定两个 C03 capability；问题非空且最多 8000 UTF-8 字节；预算以整数字符串处理，1–1000000，不做浮点换算；deadline 必须 UTC Z 且未来 24 小时内。请求仅 capability/dataSnapshotId/question/budget/deadlineAt，不信任客户端 tenant、workspace 或额外字段。附件上传由后续适用任务提供，本轮不假造已扫描附件。
- 快照选项复用 UI-204 runtime 分页与 snapshotPolicy，不把读取/对比通过视为用途授权。提交时重读 C01 与 C04，检查质量 verified、qualityBlocked 明确 false、许可标签、schema/hash/时间窗/时效；再由服务端校验实际用途及 deadline。C04 元数据标签不表示独立用途许可。
- 一次在途请求；请求带随机 Idempotency-Key、X-Request-Id、CSRF。202 必须有匹配 jobId/statusRef、accepted 状态、auditRef/correlationId；显示“已受理，尚未完成”，不启动外部引擎。成功后表单锁定，显式“填写另一项研究”才可开启新意图。
- 运输中断、超时、响应损坏/无效、5xx 或 409 保守记录结果未知，锁定原内容，只能显式重用原 body/key；不自动重试。原 deadline/快照失效时拒绝重发，先查询列表核对。离开页面或失效后不持久化 body/key；再次进入必须先查原任务，避免把新 key 当成恢复。
- 422 仅在通过 ErrorEnvelope 验证后将白名单字段错误映射到原控件并聚焦；使用固定安全文案，不回显原始 message/fieldErrors 内部内容；保留合法 correlationId 以便审计。429 按 retryAfter 在 1–3600 秒内有界等待（缺省 60），拒绝点击不延长原冷却，无自动重放。
- 复用 route-access 的撤权 SSE、5秒 C01 检查、8秒最长未验证窗口；离线、失焦、隐藏、过期、scope/MFA 变化、流失败清空页面/表单/回执并中断在途请求。显式恢复只重新验证，不重放写入。所有操作状态仅内存。

验证：`node scripts/ui201-review.mjs --run <新 attempt>` 冻结本机候选后执行当前测试及必要构建；`--verify` 只核验证据，不触发全链复验。开发阶段不要求 G1-DEP-01 等辅助项 READY；INTEGRATION 仍要求现有阶段门禁。

保留：reference cookie 身份/CORS 本机代理替代；Firefox 环境阻塞、WebKit 附件拦截阻塞、原 P05 六项图标对比度 incomplete 及全部历史 NOT_RUN。真实身份/CORS、Supabase/私有 Storage、外部 provider/引擎、生产托管、远程同 SHA CI、性能/长稳、人工读屏/原生缩放与跨 OS 均未在本轮验收。当前功能证据不提升 G1/FEP-1 联调、发布或 runtime admission。

本机静态服务须优先解析同名 `.html`，即使存在用于 `/research/new` 的 `research/` 目录；同时验证 `/research/`、`/research/new/` 与既有 UUID 别名。此修复只验证本机 host，不提升 productionHostingRewrite。列表横向滚动区带键盘焦点和区域标签，空列表同样可键盘访问。
