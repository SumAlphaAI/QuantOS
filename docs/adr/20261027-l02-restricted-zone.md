# L02：静态 Vault、真实 mTLS 与受限宿主

日期：2026-10-27。状态：本地功能实现；未部署、未接入目标数据库。

沿用 Supabase Vault 静态秘密，不引入动态租约或生态外秘密服务。只有 Execution 专用数据库角色可调用证书/版本/账户绑定函数；研究、UI 和普通 BFF 无函数授权。实际边界由数据库授权与受限宿主共同组成，不能由 ZoneCaller enum 或请求声明 fingerprint 取代。

- [Supabase Vault 官方文档](https://supabase.com/docs/guides/database/vault)：秘密加密存储，通过 decrypted view 使用。限制 view 权限与函数授权是项目自有最小权限设计；未执行目标验证。
- [PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html)：SECURITY DEFINER 使用函数所有者权限，因此固定空 search_path、限定对象名、撤销 PUBLIC/旧 overload，并只授予执行角色。静态检查不证明实际角色继承或数据库行为。[ALTER ROLE 权限规则](https://www.postgresql.org/docs/17/sql-alterrole.html)要求非 superuser 受限修改特殊属性，因此迁移只校验危险属性并设置 NOLOGIN/NOINHERIT，不尝试修改 SUPERUSER/BYPASSRLS。
- [OpenSSL Rust SslAcceptor](https://docs.rs/openssl/0.10.81/openssl/ssl/struct.SslAcceptor.html)、[SslConnector](https://docs.rs/openssl/0.10.81/openssl/ssl/struct.SslConnector.html)：分别处理服务端和客户端 TLS；客户端域名用于 SNI/hostname 校验。本项目要求客户端证书、关闭会话恢复票据、逐次验证指纹与证书自身期限，并用真实临时证书测试双向拒绝。

当前库/测试不提供公开 live 订单路由，也不实现 Binance HTTP；自有 fixture 模式的签名 key 随进程随机生成，签名摘要只作诊断。控制面 registry 和 SQL version 行须在目标环境一致更新，不一致即拒绝。操作系统网络模板默认拒绝所有地址，实际域名/IP、部署、撤销传播、持久状态和恢复 SLA 由目标阶段独立验收。
