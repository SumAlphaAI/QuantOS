# G0 legacy backend 迁移与范围收口

本轮完成G0原稿确认记录及原范围收口，再移除生产API包中的四类InMemory backend与TerminalClient/createTerminalClient运行时构造器。terminal/strategy/execution/ops四模块只保留已有UI兼容类型，所有状态和组装都位于apps/terminal/tests/fixtures/scenarios；生产消费者继续使用生成BFF client。兼容view-model不是新的HTTP DTO，不改变OpenAPI或provider行为。

原29项U01/S04/X06/L03 UI场景断言保留；测试adapter使用生成operation metadata、响应Zod及真实生产transport（注入无网络fetch）核验fixture投影。fixture内确定性状态与worker完成只用于UI呈现测试；202只记accepted，完成观察独立读取。模拟M5 flag不提供真实Live权限；UI冲突投影不伪造StrategyRelease不存在的conflict枚举；真实SSE信封使用生成StreamEvent校验。本轮并不将这些fixture作为真实BFF交付/联调证据。

生产四模块须只有类型声明，构建JS须为空导出；生产图禁止任何legacy类和tests/fixtures重导出。脚本拒绝改名构造器、别名重导出或跳过生成adapter。源码、原确认、改动范围、命令/日志及单次Web基本PoC绑定冻结候选，不递归上游Gate、不重跑134 API/Rust/Proto/全视觉平台或三次构建。原G0、ALL工程与用户确认均按原SHA验证引用。

依据用户确认规程第5步，功能输入变化时更新文稿，不能将已确认的e4434952 G0输入改绑到迁移后源码。原G0确认收口READY保留；当前G0/ALL若缺新范围确认则BLOCKED。G0-L10-2仅IMPLEMENTED_ENGINEERING，历史整项不CLOSED；其他18项/负责人/期限保持。`pnpm finalize:g0-development`在收到当前稿真实确认后只收口同一工程输入；新旧entrypoint日志分目录保存。

完整业务/UI联调、真实Supabase/PostgreSQL/IdP/Auth/RLS/Storage/持久恢复、外部数据许可/venue、目标安全/性能/长稳/部署/同SHA CI与RELEASE仍NOT_RUN。生产凭据、推送、部署均未授权。
