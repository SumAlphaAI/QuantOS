# PROVIDER:A6 当前功能汇总准入

依据最新AGENTS.md，仅四个A6 API：C02 Command summary/stream与C17浏览器策略/下载历史。三个前置FE:BFF-FE-002、FE:BFF-FE-011、PROVIDER:A5的人工确认、源码、技术回执/日志和产物保持原范围引用；不调用其Gate，不递归验收A5的58项业务或全仓、三轮独立构建。

A6_SCOPE_LOCAL在同一冻结源码执行当前API、模块组合、契约/权限/恢复/敏感字段与必要编译静态检查。新增同provider Rust组合及真实生成consumer，验证导出/取消不会改写Command revision/帧或增加执行权限；本机permission只缩小能力，server始终unknown；历史不带签名URL；游标、stream token不能混用；当前成员撤销、隔离、会话到期先于历史恢复。

期限独立：Command投影/stream不晚于ready来源最早期限且至多30秒；执行参考来源60秒，不能在31秒错误声称陈旧。历史游标60秒、继承初始deadline，不随独立observer更新续期；下载链接至多300秒且不晚于保留期/会话。到61秒即使observer刷新也不能将过期执行来源改成fresh risk。2000行来源、有限帧/游标等原边界保留，不声称跨实例/重启持久恢复。

HTTP重新执行两项子范围probe，四个API均在本候选运行，覆盖成功、各自适用的拒绝、schema和基本Chromium；运行probe不等于重授组件Gate。成员管理、MFA及受控导出只作为A6组合前置，不进行A5完整业务复验。C17浏览器策略对所有有效身份可读，Viewer不获得C02/下载历史业务权限；不伪造其403。C02仍只读，不记录risk decision或消费审批；reference合成研究/导出、有限snapshot流与真实业务链分账。

冻结回执验证源码/输入、命令/时间/exit/signal/timeout、日志和嵌套HTTP产物、逐helper覆盖率、实际CI/严格入口、原确认与回滚；只有当前A6汇总节点READY，前置当前独立Gate不重授。完整稿由Codex拟定，用户一人确认六维度；当前A6稿PENDING。

FUNCTION_IMPLEMENTATION单独记PASS；完整P02/P17/UI101/UI104/G1/FEP1业务联调、真实Supabase/PostgreSQL/RLS/IdP/MFA/Storage和下载内容单次消费、实际worker/feed/Engine、持久事务/跨实例恢复、实际部署CSP、目标安全/性能/容量/长稳/部署/同SHA hosted CI与RELEASE均NOT_RUN，目标自动化NOT_IMPLEMENTED，runtime DENIED。不用生产凭据，不推送或部署。
