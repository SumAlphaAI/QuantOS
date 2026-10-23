# UI-301 Strategy 目录与 Lab 草稿

任务依据：[执行计划 UI-301](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-ui-301)。当前工作是 DEVELOPMENT 功能范围；完整 I3/FEP-3 联调、G3 与发布独立记账。

## 功能与接口

- `/strategies` 读取 C05 服务端目录，按名称/更新时间排序、分页；不推算全局总量。`/strategies/:strategyId/lab` 读取版本化草稿，显示策略 ID、objectVersion、快照引用和更新时间。
- `/strategies/new` 明示当前 C05 没有浏览器创建接口。策略须由服务端注册受信输入；前端不伪造策略 ID、输入、模板、许可或创建成功回执。该限制继续记录在 UI-P06 页面交付中。
- 文件和参数使用 JSON 对象编辑器。文件值必须是字符串；请求体上限与 C05 相同，为 32768 UTF-8 字节。文件内容不执行。静态检查、回测和 Release 属于 UI-302/UI-303；本任务仅保存草稿，保存不证明策略可运行。
- 有效编辑停止 1000ms 后自动保存。每次 PUT 携带已读取的 `If-Match: objectVersion`、独立幂等键、请求 ID 与 CSRF；身份、租户、工作区及模式来自 C01，不进入请求体。一个保存操作在途时不重入；期间的新编辑保留，成功后使用新版本继续保存。
- 409 保留基础版本与本地内容，重新 GET 当前服务端头部并显示逐字段基础/本地/服务端 diff（含新增、删除）。不会自动改用服务端版本写入。用户编辑合并内容后显式确认，再手动保存。服务端再次变化仍由 `If-Match` 拒绝。冲突读取失败时保留本地内容，可显式刷新。
- 网络、超时或无法验证的响应标记结果未知，暂停自动保存并锁定编辑。仅显式重试原内容、原版本与原幂等键；不会换键覆盖。422/429 等确定拒绝暂停自动保存，显示安全提示；429 等待冷却后手动重试，不展示服务端内部文本。
- 未保存内容仅留在内存；离开前提示。C01 范围改变、权限撤回、离线或有效期届满时清除页面/缓冲并中止请求。恢复须重新授权和读取；不重放保存。只读审批者只能读取；C05 读取权限为 strategy.write 或 strategy.approve，写入仅 strategy.write，模式仅 paper/shadow。

## 验证与证据

执行 `node scripts/ui301-review.mjs --run <全新 attempt 路径>`；随后 `node scripts/ui301-review.mjs --verify` 核对来源提交、输入哈希、命令退出码、日志和浏览器产物。源代码先提交，回执另提交；后续证据/报告提交不改绑来源 SHA。

只执行当前状态机/契约测试、DraftBuffer 回归、两个 C05 并发/幂等服务测试、reference BFF 构建、Terminal 类型/静态检查与一轮构建，以及 Chromium 实际页面场景。共享静态路由新增 Lab 后，直接回归路由解析和静态服务器。无全仓、无递归上游闭包、无三轮构建、无 F05/F07 数据库 campaign。

浏览器使用新构建的本机 reference BFF，业务响应为实际 C05 字节。身份 cookie 注入及 loopback HTTPS/CORS 代理为显式替代，不构成真实 IdP/CORS/目标服务联调；422 注入明确标记为合成故障。409 来自真实并发保存，丢失响应发生在真实保存成功后。浏览器仅写 reference 进程内草稿。

静态资源主机本机验证 `/strategies/:strategyId/lab` → `strategies.html`；托管平台 rewrite 仍 `NOT_RUN`。Firefox/WebKit、真实 IdP/MFA/CORS、Supabase/RLS/事务、目标 Storage、部署、远程同 SHA CI、性能/容量/长稳、人工读屏/native 200% 缩放及发布验收均 `NOT_RUN`。axe incomplete 必须保留，零自动 violations 不等于完整无障碍验收。

功能证据不自行批准用户验收。`development_status=IMPLEMENTED_PENDING_ACCEPTANCE`，`stage_gate=INTEGRATION/NOT_ASSESSED`，`formalAccepted=false`，`runtimeAdmission=DENIED`。下一原计划任务为 UI-P06 高保真页面交付。
