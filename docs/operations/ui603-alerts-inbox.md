# UI-603 Alerts 收件箱功能规程

范围：I8、C16，主分支本机功能实现。页面 `/alerts` 与 `/alerts/<UUID>`，新 Alerts 导航仅接受 C01 的 `alerts.read`。以 reference C01/F06/C16/X06/F09/C10 实际 Rust 模块和受控输入验证；不使用生产凭据、不执行数据库、不推送或发布。

## 行为与边界

- C01 session/context绑定actor、tenant、workspace、account、mode、environment、MFA、capabilities与最短有效期；权限流/轮询与离线/隐藏/焦点变化关闭运行时并清除告警、订阅和未决意图。仅Paper/Shadow，不授予现场交易权限。
- 列表支持状态、严重程度、领域、active、UUID排序，固定100条页，最多10页/1000条；冻结cursor与configVersion，验证账户/模式、重复ID、顺序、过滤匹配和循环cursor，拒绝跨页混合。错误需显式重新读取；“已加载”不等于全局未读总数。
- 详情验证UUID一致、源摘要、时间、版本、active/resolved与ack字段约束。服务端仅提供rule，无编造的标题/指标/事件文本。objectRef `/operations/health`展示为来源引用，UI-601未交付不伪造处置入口；有C01 audit:read才展示C10审计链接。
- ack/unack仅逐条：ops.operate、桌面>=768、明确原因/确认、服务端MFA=verified、近期认证且未过期；发送前重读详情逐字段核对。CSRF、If-Match、UUID幂等键与request ID冻结；无乐观写、无批量API。回执必须version+1、对应actor/auditRef并完整保留来源字段与active/resolved，已读不代表风险解决。
- 网络/解析/回执未知保持原请求锁，不自动重试；显式恢复复用原body、proof、key、CSRF、requestId、version。已知首次409/429等拒绝清除旧详情/订阅，重新读取与审阅；未知恢复收到拒绝仍保留未知锁，401/403/失权则清除。429按服务端retryAfter（1..3600秒）冷却，原错误message不渲染。离开后未知写可在新会话读取服务端事实，旧意图不会跨会话保存。
- 订阅是完整domains/severities集合的CAS PUT，非market开关；拒绝空/重复/未知值；保存回执精确匹配集合、version+1及审计引用。订阅变化丢弃旧stream租约，须手动重建；冲突不自动覆盖他人改动。
- 有界SSE：10秒/1MiB/32KiB frame/1000事件，fatal UTF8、完整帧、当前streamId、dense sequence、精确event去重、对象/来源版本不回退。撤权事件优先关闭。EOF为disconnected，失败为reset-required；手动续接/重建，无无限自动重试。实时事件只提示显式重读，不拼进冻结列表/详情。订阅和分页独立。
- 不在localStorage/sessionStorage保存告警、身份、验证proof或请求意图。移动端只禁高风险ack/unack，仍可读取和调整订阅。UI-P23高保真/响应交互深化留给下一任务；C02原 `/operations/alerts/:id` objectRef契约未改写为另一契约。

必要修复：reference冷启动C01曾提前声明默认未启用的ops.approve，首次C16初始化后被收窄，导致Approver页面正确清空。已将冷启动声明与seed中有效权限一致化；增加四种身份原生回归。未启用ops.approve、未扩大角色权限、未改live授权。

## 验证与验收

`node scripts/ui603-review.mjs --run docs/audit/evidence/ui603-local-20261024/attempt-NN` 在已提交的冻结源码上执行直接测试；`--verify` 校验原源码输入、每条命令/原日志/产物摘要、fresh binary和terminal build、浏览器无重试/skip及边界。受影响回归限C16现有消费者、P18订阅、导航与静态路由、开发阶段门禁。Rust仅operations模块，不递归上游/全仓数据库campaign。

工程状态：IMPLEMENTED_PENDING_ACCEPTANCE；工程PASS要求全部命令符合预期且证据核验通过，正式stage_gate仍NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。INTEGRATION CLI应拒绝；UI-P23 DEVELOPMENT应允许。

保留G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN和FEP-4 PARTIAL；UI402-MARKER-SOURCE-01真实C09→C12同源正向NOT_RUN、P19-C10-EXPORT-01蜡烛导出NOT_IMPLEMENTED、C12→C14估值join NOT_CLAIMED。历史包只作ORIGINAL_SCOPE_ONLY，不改字节、不重绑。

真实IdP/cookie/CORS、目标DB/RLS/事务、外部告警源/实时长连接、远程同SHA CI、Firefox/WebKit、完整I8集成、性能容量/长稳、人工读屏/原生200%缩放、RELEASE均NOT_RUN。reference身份cookie桥接和TLS/CORS回环代理是明确替代，浏览器故障注入另标SYNTHETIC，不能提升为生产验收。
