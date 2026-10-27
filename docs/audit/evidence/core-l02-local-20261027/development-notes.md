# L02 原始失败、修正和范围

开始基础 4e20dc2fd6fca4e3bfc20cf63a8057cb5a49408a（main，工作树干净）。实现提交 8df7cea9d99dae73b8626b326954ea8a1c7e3485；最终候选 379f624b5e45fa4c22231f25ac06ad54f7c049ec。后一个提交只改 L02 审计工具、规程与保留失败材料；运行时代码不变。最终 attempt-02 的 18 项按新候选重采，未新增上游/全仓/数据库检查。

- preflight-01：旧 zone 0 pass / 3 fail；未来服务会话、签发/轮换前凭据、300 秒闭区间均未拒绝。现在分别验证 issued_at、单调版本/生效时刻与半开 drain。
- preflight-02：开发期旧 example 入口的 3 项真实 TLS 子进程通过；未冻结源码，不能作为最终候选结果。后改为 execution-gateway 显式 owned fixture 模式，标准 cargo test 自动构建 binary，避免 CI 只构建 tests 时找不到 example。默认服务没有新增公开订单入口。
- preflight-03：1 pass / 3 fail；增加证书自身有效期重检后，固定午夜逻辑时钟早于当日临时证书 not_before，被正确拒绝。保持证书检查，用当前时间取样测试基准后推进逻辑 schedule。
- preflight-04：host-unit 12 pass，process 3 pass / 1 fail；测试在循环中重复取当前时间，使所谓 expired-command 相对宿主冻结基准仍在未来。改为每个测试只取一次基准。没有修改 TTL 或证书安全语义。
- preflight-05：修复后的 process 4 pass；未冻结源码，仅开发验证。
- attempt-01：8df7cea9 的 Rust 54、Node 90、静态/准入符合预期，最后 secret-scan 失败；Gitleaks 发现 main.rs 的历史公开 F06 幂等值（不是凭据，.gitleaksignore 已有其原 Git 指纹）。未伪记通过。
- preflight-06：对该历史值的 targetRules/global 排除没有得到预期 0；报告保留，改为该规则的局部 AND 排除。
- preflight-07：正向 0，首个合成负向只检出 1/2，未算负向通过；改用自有高熵非凭据值。
- preflight-08：正向 exit 0/report=[]，负向 exit 1/2 findings。证明精确规则+路径+公开值的排除不覆盖同文件其他值或其他文件同值。全局 .gitleaks.toml/.gitleaksignore 未改动。
- attempt-02：最终候选 18 项符合预期；Rust 54、Node 93，真实 mTLS 4 项/13 行矩阵、轮换与真实签发链成立；scoped Gitleaks 正向 0 泄露，2 条合成反例拒绝，保留 1 项非秘密排除来源。

开发期间还修正了 Rust 内部文档注释位置、UUID 借用、Node 括号与 ESLint 未声明全局等编译/工具问题；这些只有会话工具诊断，未补造缺失原始日志。所有 preflight 为工作树开发记录，没有冻结完整源码；只有正式 attempt 的 inputs/sourceCommit 绑定可作候选证据。

库使用真实 TLS verified peer、registry 与 VaultSigner；数据库 adapter 仅编译，测试执行的是进程内随机生成的合成 HMAC key。签名摘要只作诊断，不是订单权限、Binance REST 签名或交易所回执。生产 ingress、真实 Supabase/Vault/角色/RLS/迁移、OS/网络策略安装、目标证书/秘密轮换与 ≤5 分钟 SLA、受限取消/恢复全链、持久/多副本幂等、真实 testnet、同 SHA 远端 CI/性能/长稳/正式验收和发布仍 NOT_RUN。

没有创建本地数据库或容器，没有读取私有 dotenv/连接配置，没有生产凭据、外部 testnet、推送、部署或发布。历史 F06/L01/X3 证据保持 ORIGINAL_SCOPE_ONLY。下一可执行原节点 SERVICE:L03。
