# G1-DL-01 / G1-DL-02：封闭下载 origin 与 reference 内容交付

API 和下载内容共用一个浏览器可见 HTTPS BFF origin。服务器显式配置 `QUANTOS_BFF_PUBLIC_ORIGIN`，与客户端 `NEXT_PUBLIC_QUANTOS_BFF_ORIGIN` 完全相同；同时将 `/v1/*`、`/_bff/export-content/*` 代理到同一 BFF。Terminal 的 `QUANTOS_TERMINAL_ORIGIN` 只用于 CORS/身份来源，不再用于内容 URL；Terminal 与 BFF 可以有不同 origin。origin 必须是规范的 HTTPS origin（可含非默认端口）；禁止 path、userinfo、query、fragment、反斜线和隐式规范化。不得从 Host/Forwarded 推断，消费者不增加任意跨域白名单。

live 二进制启动现在要求 `QUANTOS_BFF_PUBLIC_ORIGIN`。已有 owner 注入的 `live::router*` 入口保留单 origin 语义（public BFF origin = Terminal origin）；分离 origin 的标准启动用 `router_with_download_origin`，不可误用旧入口。配置漏项必须先修配置，不通过信任任意地址恢复。root `.env.example` 仅保存占位配置；本轮不读取私有 dotenv、不连接目标服务、不部署代理。

reference 仅绑定 loopback，固定测试身份只在 reference 模式生效。通过真实 MFA/reauth/export API 准备内存导出，服务签发 `/_bff/export-content/{opaqueTicket}/{HMAC-SHA256}`；ticket 不是 exportId，不暴露对象存储地址。默认保留域 `https://bff.reference.invalid` 仅供 API/fixture 兼容；实际下载必须显式配置本机 HTTPS 代理 origin。原 HTTP local-integrated 模板只能验证 API，不能据此声称下载交付通过。测试在临时目录生成自签名证书，TLS 例外仅限本次 loopback 客户端/Chromium context；不是部署 TLS 可信性证明，不设置全局 NODE_TLS_REJECT_UNAUTHORIZED。

签发期限为 `min(签发时刻+300秒, 导出保留期, 当前会话期限)`。内容 GET 在同一内存锁下重验会话、权限、资源、取消/保留期与签名，原子标记一次性消费，然后核验字节长度和 SHA-256。签发不生成内容。HEAD 和 query 拒绝且不消费。ticket 表最多 512 个未到期条目，后续签发回收过期条目。成功内容为 attachment / no-store / nosniff / no-referrer；审计只记录动作、对象和结果，不保留 ticket、URL、签名或原始私有载荷。读取失败也消费该 ticket；界面需让用户显式重新申请，不自动重试旧 URL。

客户端严格解析 C10 generated schema，校验 BFF 同 origin、规范原始 URL、opaque ticket 路径、导出 ID、保留期一致及最长 300 秒。历史只存安全元数据。关闭、重载、离线、身份/期限变化后的迟到租约继续拒绝，不把返回租约当文件到达。

当前范围的确定性回归：Rust 内存状态覆盖 CSV/JSONL/PDF、并发一次消费、期限、取消、登出、篡改、会话/权限错配、存储失败/完整性失败与显式新链恢复。存储失败注入只在 `cfg(test)`，没有 HTTP 调试入口或生产故障开关。真实 Node/generated consumer 与 Chromium 经 loopback HTTPS 代理接收原字节，不用 route.fulfill 或 URL 重写；Chromium 仅证明内容传输，完整 P17 页面与跨页面旅程另行验证。

门禁入口：`node scripts/g1-download-review.mjs --verify`。限定重跑：在工作区源码已提交且无受影响未提交改动时，`node scripts/g1-download-review.mjs --run docs/audit/evidence/g1-download-local-20261022/attempt-NN`；目录不可复用。入口白名单环境，offline Cargo/pnpm；涉及 loopback 监听和浏览器时须使用允许该本机操作的执行环境。它只运行当前下载功能和直接受影响契约/消费者/类型/静态回归，不递归验收所有上游，不执行数据库 campaign。

本轮工程 PASS 不改变 G1/FEP-1 的 NOT_READY_GAPS_OPEN、INTEGRATION NOT_ASSESSED、formalAccepted=false 或 runtimeAdmission=DENIED。Firefox 环境阻塞、WebKit 拦截附件阻塞、全部原 NOT_RUN/失败与源 SHA 绑定继续保留。live DB/Storage/signer、真实 Cookie/CORS/IdP、持久撤销、人工读屏/原生200%、完整页面/跨页面旅程、跨OS、远程CI、性能/长稳与发布未执行。下一项 G1-REC-01 / G1-REC-02；P15 原稿仍待独立确认。
