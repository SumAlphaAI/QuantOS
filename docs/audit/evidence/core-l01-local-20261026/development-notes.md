# L01 开发记录与未决边界

开始基础为 a3816e35（main）。实现候选为 decf787ff12e1caa2917ad2fd9fcfa8b9496d0b9；attempt-01 完成全部当前检查，无失败或跳过的当前必需命令。

preflight-01 原始 3 失败证明旧配置接受非批准 origin、未限制精度/预算且 Debug 回显可变配置。现以完整相等白名单、精度/预算上限和固定脱敏输出修复。preflight-02 保存 6+15+1 项开发测试通过；两份 preflight 未冻结完整工作树，不作为最终候选验收。

开发期间修正过 Rust 测试借用、撤单误传 order ID、原生 RiskGuard 符号域的大小写约束，以及受控毫秒线协议与原生纳秒时钟对齐。最终保留原 RiskGuard，显式逻辑 venue slug→大写 execution venue；原生测试受控时钟上取下一毫秒。403 根据官方文档分为 AccessDenied，矛盾 200 错误体保留未知。Decimal 使用 from_str_exact，避免先解析舍入再校验。计划校验最初因摘要前缀和未创建证据 README 失败，完成文档后通过。以上开发诊断仅会话工具输出，不伪造缺失的原始日志。一次非白名单 pnpm lint 调用最终 exit=1（registry.npmjs.org/pnpm fetch failed），不记通过；白名单固定 pnpm 与最终 attempt-01 ESLint 均通过。受限沙箱中的 ps 不可用，不影响功能验收。

当前协议端口没有真实 HTTP、认证或签名实现。规则是自有 owner 输入，仅验证指定静态过滤器；不声明交易所最新状态或全过滤器支持。预算按单内核计算，没有实现账户/IP 全局权重。未知响应保留占位并只读恢复，内存缓存上限 4096，不能跨重启或多副本保证幂等；未完成的 trade 分页不补造成交。真实时钟同步、交易所 reset、用户数据流、凭据轮换、共同持久审计、目标恢复与 C09 业务消费仍 NOT_RUN。

没有安装/启动本地数据库，没有读取 DATABASE_URL，也未连接 Supabase 或 testnet；未使用生产凭据、未推送/部署/发布。旧证据保持 ORIGINAL_SCOPE_ONLY。正式验收待用户确认本份文稿及独立阶段 Gate；工程通过不要求此时强制完整上游重验。下一原任务 CORE:L02。
