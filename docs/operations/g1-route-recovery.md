# G1-REC-01：Command / Settings 路由授权失效与恢复

实际 `/command` 与 `/settings/{profile,security,notifications,browser}` 通过共用 `auth/route-access.ts` 管理访问租约。业务投影仍由 HTTP 快照提供；会话 SSE 只作授权失效通道，不把它标作 Command 领域实时流或完整业务联调。

初次私有快照不直接发布：先完成原顺序 guard/private read，再建立 cookie-authenticated `/v1/settings/sessions/stream?afterSequence=0`，并用 C01 session/context 双重重读确认 actor、tenant、workspace、account、mode、environment、MFA 和完整 capability 集合未变化。检查完成及访问租约有效后才发布。握手/每次 C01 复查总期限 3 秒，所有请求 no-store。SSE `permission_revoked` 或 401/403/404 为失效；其他会话的 `session_revoked` 只确认读取进度，不能授予本会话权限。信封必须通过 generated schema；无效 JSON/UTF-8、超16Ki字符帧、未知事件、streamId变化、EOF和网络失败均清空当前授权，不静默保留投影重连。

主通道是服务端的授权 SSE。客户端另每 5 秒读取 C01，权限观测有效期最多为上一复查开始时刻后 8 秒（含请求预算），并取 session/context/资源到期最早值。未收到事件、流静默或 C01 stalled 时也不能无限维持私有 UI。同步 `assertCurrent` 在写入前及异步后检查期限、在线/可见性，即使 React/定时器尚未刷新也拒绝动作。计时是浏览器前台执行模型；后台/隐藏立即清空，不将测试等同于 OS 调度、真实目标性能或撤权传播 SLO。

原服务的每用户会话事件使用全局 sequence，数字空洞不等同于缺失该用户事件。这里不构造业务投影或权限增量：sequence只用来丢弃普通旧通知，任何合法permission_revoked均优先失效；真实权限仍由C01和服务端写入 owner决定。流中断后的恢复显式新建监控、重读 guard/快照再开放；没有携带旧权限自动恢复，也不依赖重放任意授权授予事件。缺失 SSE 支持时安全拒绝私有发布，不降级为不受限快照。

离线、页面隐藏、窗口重新聚焦、跨标签页身份变化立即关闭监控与业务 controller、取消在途请求、清空私有投影/敏感草稿并显示“重新验证访问条件”。上线/重新可见不重放写入，用户显式重试读取。身份/权限终态跳转安全登录/unauthorized表面；存储不保留 token、会话、私有草稿或租约。`sessionStore.clear/set` 发布同进程与 BroadcastChannel 失效提示；不支持时用立即删除的 localStorage 控制信号。消息仅 version/type，无身份事实或权限授予；伪造 grant 消息忽略，其他合法失效提示最多降低可用性。

Settings 正常手动刷新在有效授权内保留工作区草稿，并冻结写入；一旦授权丢失则卸载工作区、清除草稿。runtime 在 profile/notification save、MFA challenge/reauth/DELETE、rebase、download 等路径检查访问/代际，旧代际结果不能写回新快照或继续下个高风险请求。已发出的写入可能已在服务端提交：本轮只取消/拒绝客户端后续发布，不声称回滚。未知结果与旧幂等键规则保留；身份失效后禁止自动重试，恢复后按服务端事实重新核对。

验证包括确定性监控/异步 race 单元测试，以及实际构建的路由在 Chromium 对接内存 Rust reference 的 SSE 登出撤权/断线重读。C01变更、最早资源期限、write403和浏览器隐藏用例显式标记为故障注入，不宣称所有响应均真实。代理仅为本机测试身份/CORS端口桥，其他响应字节原样；真实IdP、Cookie/CORS、目标DB/RLS/持久撤销与部署均NOT_RUN。Firefox/WebKit阻塞和全部原NOT_RUN/失败继续保留；live源码的每次流交付重新验证逻辑只作原范围参考，不在本轮运行目标服务。

门禁 `node scripts/g1-recovery-review.mjs --verify`。只运行本功能与直接受影响的 auth/Command/Settings/下载回归、integrated/mock各一轮必要Terminal构建（路由两种模式均直接受影响）、已有BFF二进制构建（Rust源码未改）、Chromium及静态检查；不递归重跑上游或数据库 campaign。工程PASS仅本机 reference 授权失效范围，确认PENDING、G1/FEP-1仍NOT_READY_GAPS_OPEN/INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。下一任务G1-REC-02同候选完整业务旅程，P15独立确认和其余义务继续保留。
