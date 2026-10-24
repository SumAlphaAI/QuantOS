# UI-602 Admin 治理功能

本任务交付 I8 的 Admin 业务功能。五个静态入口为 `/admin/members`、`/admin/roles`、`/admin/policies`、`/admin/capabilities`、`/admin/flags`。对应 C11 API 最后一项使用 `feature-flags`，其余同名。UI-P14 高保真设计验收留待原下一任务，不以本次功能截图替代。

## 权限、读取和写入

- C01 `/session` 与 `/context` 的 actor/tenant/workspace/account/mode/environment/MFA/能力须一致，保留较短有效期；仅 paper/shadow、`admin.read` 可读取。沿用 C01 撤权流、轮询、离线/隐藏/焦点变化失效处理，关闭时清除全部治理数据、表单、回执和内存恢复意图。`admin.read` 导航别名只提供 Admin 读入口，不创建 `admin.write`。
- C11 五类目录使用服务端冻结游标，按 id 排序，每页 100、每类最多 10 页/1000 条；拒绝重复/回退 id、循环游标、跨页或跨类 configVersion 混合。发布目录前重读配置头，失败保留未核对状态，不拼接部分成功。
- 写入需要桌面 >=768px 和独立 `admin.write`；真正 Owner、原始身份上限及职责分离由服务端决定。每次明示审阅字段、原因、MFA、近期认证，再重新读目录核对配置/对象来源。创建用 configVersion，修改/删除用 objectVersion；每次新意图唯一 Idempotency-Key / X-Request-Id，并携带 CSRF。
- 返回成功还须严格通过生成的 AdminResource schema：类型/目标 id/原 spec/墓碑/对象版本 +1/全局配置版本 +1/非保护资源/非空 auditRef 与 correlationId。创建对象版本为 0。禁止以 202、无审计数据、错误版本或乐观更新代表成功。提交后清空旧目录，显式重读才可再次写入。
- 超时、网络错误、5xx 或不可验证回执均保留原方法、URL、完整 body、If-Match、CSRF、幂等键和请求 ID，仅支持同一存活会话显式恢复。未知状态禁止新建/刷新；恢复时即使 409/429 仍不解除原未知，401/403 或身份/CSRF/有效期变化清除私有意图。新请求的已验证 409/410/422/429 拒绝解除本次意图并要求重读；429 保留冷却。无自动重试或浏览器存储。

## 五类表单与治理边界

| 类型 | 可编辑内容 | 服务端保护 |
|---|---|---|
| 成员 | 已登记 actorId、现存角色、active | 非邀请/身份创建；未知 actor 拒绝；不可提升原始身份；保护最后管理员、自身/同用户治理；墓碑不可复活 |
| 角色 | 名称、operator/approver/viewer、权限子集 | owner/service 不可自行创建；保护基础角色；在用角色不可删除；名称墓碑防 ABA |
| 策略 | 名称、现存角色、唯一拒绝权限、active | 无任意表达式；不可移除最后同时具备 admin.read 和 admin.write 的管理员 |
| 能力 | 固定权限能力启停；Engine 有效签名审查目录及启停 | admin.write 受保护；Engine 绑定 reviewId/name/version/description，服务端有效期与审查者/启用者分离；不能上传/生成签名 |
| 开关 | 固定四种开关、enabled、0–100 整数 rolloutPercent | 无任意安全开关；无任意脚本/命令；删除保留墓碑 |

所有创建、更新、删除由 C11 原子提交与 C10 append-only 审计负责。页面只保留当前存活会话最近 25 条已验证回执。Reference Owner 没有 C10 `audit:read`，因此只显示真实 auditRef/correlationId；仅当当前 C01 独立授予审计读取时提供 `/audit/{correlationId}` 链接。组合测试使用独立 `session-current` 审计会话验证所有成功治理事件，不能把 Owner 身份推导为 Audit 权限。

## 本地验证与证据

使用真实 Rust reference BFF + 生成 schema/公共 BFF transport + 当前前端，原生 governance 22 例与实际 HTTP 组合覆盖五类 CRUD、Engine 签名能力启停、最后管理员/职责分离、版本拒绝、墓碑、幂等恢复和 C10 回链。Chromium 使用回环 TLS/CORS 代理和显式合成 Cookie 身份替代，非真实 IdP、浏览器 Cookie/CORS 或生产签名发布验证。MFA `123456` 仅该既有 reference fixture。

运行 `node scripts/ui602-review.mjs --run docs/audit/evidence/ui602-local-20261024/attempt-NN`（先本地提交冻结源码，必须新目录），复核 `node scripts/ui602-review.mjs --verify`。该脚本只执行当前功能与共享导航直接影响：Rust governance、类型/ESLint、UI602 provider-consumer、既有 operations consumer/shared navigation、静态路由/Gate 拒绝、单轮 Terminal 构建与 secret scan、六项 Chromium 场景及四次 axe。输入、源码 SHA、binary/build 哈希、原始日志、截图和历史证据摘要独立封存。

工程 Gate 只在完整新矩阵通过后为 `PASS_UI602_ADMIN_GOVERNANCE`；功能状态 `IMPLEMENTED_PENDING_ACCEPTANCE`，正式 INTEGRATION Gate 仍 `NOT_ASSESSED`、formalAccepted=false、runtimeAdmission=DENIED。

## 保留缺口

G4 `IN_REVIEW`，G4/FEP-4 `NOT_READY_GAPS_OPEN`，FEP-4 `PARTIAL` 不变。UI402-MARKER-SOURCE-01 同源 C09→C12 正向仍 NOT_RUN；P19-C10-EXPORT-01 蜡烛导出 NOT_IMPLEMENTED；C12→C14 valuation join NOT_CLAIMED。UI601 HTTP InspectEvidence 正向仍 NOT_RUN_REFERENCE_SOURCE_UNAVAILABLE，修复后 resolve 正向仍 NOT_RUN_NO_REPAIR_HTTP；P13-C11-SERVICE-01 七服务独立健康/心跳/历史诊断仍 OPEN。

真实 IdP/Cookie/CORS、Supabase/PostgreSQL/RLS/事务、外部源/venue、远程同 SHA CI、Firefox/WebKit、人工读屏/200% 原生缩放、性能/容量/长稳、完整 I8 集成及 RELEASE 全部 NOT_RUN。未使用生产凭据，未推送、部署、发布，未重绑任何历史 PASS。下一原开发任务 `FE:UI-P14`。
