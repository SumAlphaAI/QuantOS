# UI-P15 个人设置当前页面范围

依据P15高保真v2设计与前端执行计划UI-P15，交付`/settings/profile`、`/settings/notifications`、`/settings/security`。沿用已确认UI-104的C01/C17管线及安全边界，每个分区先校验session/context的身份、主工作区、账户、mode、MFA与settings.read，再按需读取本分区，profile不依赖security/download权限。会话和context最早期限决定投影有效期，届时清除并重验；无自动fixture回退。

资料、区域与通知均通过生成client/schema、白名单、CSRF、If-Match和幂等键保存。显示/时间/密度/对比度/减少动画在当前页面预览，成功200后更新基线；仅保存语言偏好，完整英文界面另行完善。服务端时区保留，日期按所选locale/timezone/timeDisplay格式化，原时间戳不改变。profile与区域共用一个版本，通知单独保存，页脚明确分区与未保存状态，不提供非原子的“保存全部”。重新读取/冲突保留未通过客户端校验的草稿，保存时仍严格校验；角色/邮箱/成员ID不允许写入，返回其他member的成功响应拒绝。

未知结果保留草稿、原版本和幂等键，须明确重试；409须明确读取新版本、保留草稿后再次保存。429按retryAfter暂停写入，无期限时保护性等待30秒，不自动重放。断网只读，网络恢复仍等待明确重验，不自动提交。草稿仅存页面内存，离开页面/关闭标签会丢失，不持久化身份、业务事实、MFA码或验证引用。

MFA因素、会话和设备的读取与撤销全部使用C17接口，先验证目标、当前/最后因素保护、桌面宽度、在线、写权限、精确短语与六位码，再调用C01 security_change→reauth→C17 DELETE。202只表示受理，保留资源和pending按钮，重新读取服务端事实核验最终状态。独立“重新验证身份”执行C01两步，不发DELETE，返回视图仅有有效期，不保留reauthTokenRef。当前会话/当前设备/当前或最后因素拒绝；小屏隐藏高风险动作，resize/断网使确认上下文失效。安全审计入口受audit:read裁剪。

新增Passkey、恢复代码与密码管理沿用UI-104原组织身份服务边界；当前C17没有这些秘密签发/下载/注册操作，页面仅提供明确管理说明，不显示虚构按钮或成功。不得将读取MFA状态/撤销/近期验证宣称为新增因素或恢复码验收。

通知矩阵和跨午夜静默实际保存至C17；Desktop仅跨端偏好，Web不承诺原生投递。服务端未提供摘要发出时间时不显示固定08:00。浏览器通知仅明确点击且native default/安全上下文/策略允许才请求；拒绝后不重复弹窗，站内风险状态独立。原生通知投递与真实服务投递NOT_RUN。

样式限定P15，复用冻结语义token；桌面身份栏/分区/上下文侧栏、小屏内滚表格键盘焦点、主题、CSS zoom=2验证；原生200%/人工读屏另记。Settings共享Chrome取消无事实的Live/Normal/通知3，并直接回归P17浏览器页；不宣称已完成UI-P17。仅迁移Chromium/Darwin的两张原Settings图像，原件和catalog逐字节保存；6张新P15双主题基线初始化后按冻结工程比较，不等于独立设计签署，其他OS/browser比较NOT_RUN。

入口`node scripts/ui-p15-review.mjs --run docs/audit/evidence/ui-p15-local-20261022/function-attempt-NN`，需先提交工程。限定当前单元/组合、直接UI-104消费者、必要types/lint/双profile构建、视觉和计划，不递归复验16项前提。实际Rust reference以环回进程和内存种子提供者运行；浏览器测试身份/CORS桥接转发原响应，安全响应仅留hash，非真实IdP/浏览器Cookie/CORS/目标数据库/持久撤销验收。环境白名单不加载生产凭据。

当前工程与客户端契约/受控本机组合分开记账，确认PENDING，INTEGRATION NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。Firefox保留独立环境诊断，不把诊断完成算功能PASS。真实IdP/MFA/注册恢复码、目标BFF/数据库、持久撤销、真实Cookie/CORS、原生通知投递、人工读屏、原生200%、跨OS视觉、远程同SHA CI、性能/长稳、RELEASE全部NOT_RUN。旧确认和失败证据不改写，新HEAD不自动获准。
