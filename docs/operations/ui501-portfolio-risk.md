# UI-501 Portfolio 与 Risk 功能范围

交付 `/portfolio`、`/risk`，使用公开生成 C01/C06/C16 客户端。导航的 `execution.operate → portfolio:read` 仅表示读目的地，目标路由重新授权；不创造风险写权限。P08 高保真与规则明细路由属于下一任务。

## 事实与拒绝

- C01 session/context 必须在 actor/tenant/workspace/account/mode/environment/MFA/capabilities 一致，且未过期；UI-101 路由监视器持续重验与接收撤权。离线、隐藏、焦点变化、会话撤销/过期清除组合、告警和认证引用，恢复需显式重新核验。无 URL/存储账户覆盖。
- C06 `/portfolio`、`/risk` 显示相同账户、相同 asOf 的快照；`/portfolio/stream` 的同帧 portfolio+risk 是原子投影。有限 journal 以 afterSequence 有界轮询（2s），校验 lease、密集序号、账户、版本/时间回退、Kill Switch 与 GlobalKill/AccountKill 一致性。权限终止先清除；断流、缺帧、格式错误、读取失败或距最近核验 8s 禁写，需显式刷新恢复，不自动重放命令。参考 BFF 返回有限流；真实长连接/目标恢复仍 NOT_RUN。
- stale=true、asOf 未来/未知、asOf 年龄达到 60s、C01/网络不可信均禁止所有风险写请求与 step-up。页面常驻显示聚合 Kill Switch；无当前事实显示未知。金额与数量保持字符串，MoneyValue 以单位字符串和九位 nanos 精确格式化，拒绝非法符号与小数。C06 不含估值、敞口单位、逐仓 P&L 与规则配置，不补演示值。
- C16 仅对 `ops.read` 查询当前 accountId、domain=risk，校验账户/模式/域与去重；最多首 100 条，有 nextCursor 则提示不完整并链接告警工作区。无权限/读取失败不冒充零告警。C06 规则命中不伪装成 C16 告警。告警为显式刷新快照，显示自身 asOf，不能用作风险写授权。

## Kill Switch

启用需要 Owner/Operator，账户解除仅 Owner，最终由 BFF 判定。C01 未提供角色，UI 不按 actorId 或自造 capability 推断角色。支持 paper/shadow/research，assisted_live 不开放。

用户输入原因、完整确认短语与六位 MFA 码；客户端即时清除表单验证码。使用 C01 `/auth/mfa/challenges` (security_change) 与 `/auth/reauth` 真实不透明引用，不自签/缓存凭据，不在浏览器持久化。启用短语 `ENGAGE KILL SWITCH`；解除 UI 同样要求 `RELEASE KILL SWITCH`（C06 解除请求体无 confirmPhrase）。

C06 POST 含 CSRF、请求 ID 与独立幂等键；契约未定义 If-Match，不伪造 CAS。服务端串行判定当前风险。结果未知立即停止写入并要求显式重读，状态标明最后快照待核查；锁定原动作/原因/账户/认证引用/幂等键，不可更改意图；显式刷新只读不重发。显式恢复重用原 body/key，不重新 MFA，即使原证明已过期也由服务器决定原请求恢复；恢复失败继续保留未知状态。429 有界冷却。第一次明确 401/403/409/422/429 拒绝不生成成功事实。

仅 200 且账户、递增风险版本、账户 Kill 命中、聚合状态、auditRef/correlationId 可核验才接收回执，随后重新读取事实。回执与投影独立；账户解除不意味着全局 Kill 解除。服务端拒绝角色的 403 不抹去仍获准的组合读权限；C01 撤权另外清除。成功之后重读失败继续禁写。

## 本机验证与阶段边界

`node scripts/ui501-review.mjs --run <新 attempt>` 绑定冻结源码与输入哈希，执行当前功能、实际参考 BFF 消费者、直接 C06/C16/路由/导航回归、类型/静态检查、静态构建和 Chromium 成功/拒绝/恢复/基本视觉与 axe。`--verify` 复核日志、二进制、产物、网络记录与状态。

参考 BFF 使用本机合成账户与固定测试 MFA，浏览器通过显式回环 TLS/身份/CORS 替代桥接。未使用生产凭据、外部源或真实目标数据库，不推送、不部署。工程有界结果不提升 INTEGRATION/RELEASE；目标 DB/IdP、生产 cookie/CORS、真实风控数据、持久性、多浏览器、人工读屏/native200%、同 SHA 远程 CI、性能长稳仍 NOT_RUN。正式 ACCEPTED 仍待确认，runtimeAdmission=DENIED。下一任务 FE:UI-P08。
