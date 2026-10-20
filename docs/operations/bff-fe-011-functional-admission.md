# BFF-FE-011 当前功能准入

A6 的 C17/P17 当前功能只覆盖 `getPlatformCapabilities` 与 `listDownloads`。C17 原有设置 API 由 BFF-FE-001 负责，其原回执仅为参考。依据 AGENTS.md，当前功能、必要编译/静态检查和直接受影响的生成契约/Auth/export/浏览器 consumer 回归进入 BFF011_SCOPE_LOCAL；不执行依赖 Gate、全仓测试或三轮独立构建。

服务端只声明 Web 策略和本机 permission state 的 unknown 边界，GET 不请求浏览器权限。客户端本机检测只缩小能力，拒绝/默认/不支持通知使用应用内提示；剪贴板不可用使用手工复制；离线禁用下载及领域动作；无本地文件导入。server security policy 字段不是对实际部署 CSP/header 的验收证明。

下载历史使用既有受控审计导出源；live 查询 user/tenant/actor/workspace/account 全作用域与 audit:read，来源最多2000条、超量503拒绝。只投影安全元数据，不返回对象路径、内容、reason、水印原文、会话或签名 URL。ready 且当前具备 audit:export 才给 owner 下载动作路径；历史 expiresAt 是文件保留期限。queued/generating/cancel_requested 映射 preparing（无下载动作），cancelled 映射 failed，retention 到期映射 expired；读取不生成文件或票据，不把 ready 当作已经下载。

列表 pageSize1–200，排序同值以downloadId打破平局；不透明游标绑定身份/会话/mode/作用域、查询、页大小、当前投影摘要，期限60秒且后继不续期，变更/到期/篡改422重新加载。最多512游标；进程内游标不承诺跨实例或重启恢复，范围上限适用于本开发版本。

显式下载手势使用既有 BFF-FE-007 owner 获取5分钟内、保留期及会话期内的短时链接；consumer 校验对象、HTTPS同源、BFF内容路径、无userinfo/query/fragment和当前有效期，不缓存历史 URL。实际 live 内容消费仍由既有owner执行当前身份复验、签名校验、撤销/到期与原子一次消费。本机 reference 只证明元数据/拒绝/期限，不提供目标私有Storage内容下载验收。

新确认稿必须保持PENDING直至用户确认。前一 BFF002 原确认只绑定116d076e和原稿3d86f2fb；不是新HEAD批准。真实Supabase/PostgreSQL、迁移/RLS/IdP/MFA/Storage、完整P17/UI104/G1/FEP1业务联调、跨实例/持久恢复、实际CSP部署、目标安全/容量/性能/长稳/同SHA hosted CI和发布均NOT_RUN；runtime DENIED。无生产凭据、push或部署。
