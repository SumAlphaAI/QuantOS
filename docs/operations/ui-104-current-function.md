# UI-104 当前功能复核

仅验证当前C17设置/安全/通知/浏览器能力与直接消费者，使用`node scripts/ui-104-review.mjs --run docs/audit/evidence/ui-104-local-20261021/function-attempt-NN`在已提交工程输入上保存完整SHA、命令、原始日志/截图/摘要。`--verify`核验当前输入，`--ci`输入漂移仅核验原件，不授予后续HEAD准入。不重跑上游全闭包。

入口先验证C01 session/context的有效期、MFA状态、actor/tenant/workspace/account/mode与settings.read。分区按需读取：profile不依赖无关security/download权限；notifications读取偏好/浏览器策略，security读取安全/会话/设备，browser读取下载记录及平台策略；共用个人资料只从当前受权成员读取。未通过不展示缓存/fixture，非mock缺配置拒绝。显式mock是有标识的本地演示，不声称生产执行。

保存通过生成client、输入白名单、CSRF、If-Match与幂等键。200才更新已保存基线；超时/错误保留草稿和原键/版本，不自动重试；409需要用户明确读取最新版本并保留草稿，再次确认保存。刷新/网络恢复保持草稿只读，重新验证成功才开放写入；身份scope变化拒绝合并。到期/卸载取消后续读取和发布。

会话/设备/MFA因素撤销先校验目标、短语、六位码、权限/在线/视口，再POST security_change challenge、POST reauth、校验短时引用后DELETE。每步异步返回后复核在线/视口/会话；当前会话、当前设备、当前/最后因素均保护。202只标记请求受理，保留资源并禁止重复请求，重新读取服务端事实确认最终状态；不以本地数组删除假装撤销。Dialog失败保留打开、清除MFA，取消不发请求。

浏览器通知仅用户点击且native permission=default/安全上下文/策略允许时请求；denied/default/unsupported降级站内，native授权不授予业务权限。下载历史不保留URL，点击后取同源HTTPS有效短时lease，校验对象/路径/期限后导航，不存储/日志lease。复制深链等待clipboard成功，否则显示手工复制路由；仅站内资源路径，无令牌/签名/账户信息。新增Passkey/恢复代码由组织身份服务管理，本页不提供未实现成功动作。

两种必要配置分别构建：公共local-mock与local-integrated/mock=false，后者浏览器BFF仅`https://bff.ui104.test`受控拦截，不是外部服务。实际Rust reference只绑定随机127.0.0.1端口，以测试cookie验证C17组合，不连接数据库。当前Chromium/Darwin两张Settings PNG精确初始化(all)后同构建禁止更新比较(none)，原PNG/catalog字节保留；初始化不是匹配旧图，其他平台不冒充迁移。

完整P15/P17设计与业务验收独立；人工读屏、原生200%、真实IdP/MFA、目标数据库/持久撤销、浏览器→真实服务完整联调、跨浏览器/OS视觉、同SHA远程CI、性能长稳与RELEASE保留NOT_RUN。开发功能PASS不等于INTEGRATION READY或正式ACCEPTED。
