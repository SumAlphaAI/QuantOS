# CORE:X06 当前执行、审计与运维 Terminal 功能

本项覆盖现有 P08–P14 的实际消费组合和当前缺陷修复，在 main 开发；正式联调、发布和真实目标验收分别记录。当前工程结论以[原始证据](../audit/evidence/core-x06-local-20261026/)中的冻结输入、执行日志、浏览器网络及下载内容摘要为准，不将依赖历史 READY 视作当前通过。

## 当前实现与缺陷修复

Portfolio/Proposal/Approval/Order/Audit/Operations/Admin 保留各自权限、固定账户/模式、危险操作确认、近期认证/MFA 与小屏只读约束。新组合用同一个自有 Rust reference BFF 子进程：Operator 从仓位/提案进入风控，独立 Approver 在 P10 复核并完成 MFA；Operator 在 P11 提交 Paper Command、撤单并用同键恢复丢失回执；C10 按同一 correlation 还原完整链，浏览器下载实际水印原始字节并核对 SHA-256/长度；C11 执行安全 InspectHealth Runbook；Owner 查看 P14 受控能力目录。HTTP 回执丢失在业务已提交后发生，恢复必须保持原 body/key/version/回执摘要。Paper venue 是 mock，fills 为空，不代表撮合/真实成交或 testnet。

Audit runtime 现在固定首次 actor/tenant/workspace/account/mode/environment/MFA/capability 集合，并将授权有效期限制为历次 session/context 中最短时间；重新加载不能迁移旧事实或延长原租约。每次创建/取消导出在 MFA 前重读 C01。权限/会话丢失、401/403（包含非 JSON 传输拒绝）清除内存事实、分页游标、草稿任务和未知结果键；离开页面关闭全部请求。暂时 C01 故障、429 冷却和小屏操作拒绝不丢失仍有效的原意图，桌面恢复只能显式使用原键，拒绝自动重放及换内容重试。

原生 OperationsService 测试独立覆盖 source/CAS、不同操作者审批、未知状态隔离、kill/风险/恢复、Runbook allowlist、scope 与审计事实；这里只执行当前模块及直接受影响路径。风险页成功/重复拒绝、实际 P10/P11/导出以及 C11/C16/告警的现有浏览器回归是本项直接相关验证，不递归运行 X01–X05/G4/G5/G6 的全部旧 campaign。

## 可复核执行

源码/规范/工具提交后执行 `pnpm assess:x06-current docs/audit/evidence/core-x06-local-20261026/attempt-NN`。记录器只继承工具白名单环境，不加载私有 dotenv、DATABASE_URL 或生产凭据；Cargo 离线、测试禁止外部访问。21 组命令包括当前 Rust 模块/契约、18 个 Web consumer 文件、Terminal 类型/局部 lint/门禁负向、一次当前 Terminal 构建、3 个新 X06 + 6 Audit + 5 执行恢复 + 5 运维治理 + 2 风险 Chromium 场景及计划/阶段拒绝检查。具体命令和结果见回执及 commands.md；失败/中断目录保留，未运行不得计 PASS。

`pnpm check:x06-current` 只校验冻结源码 blob/当前相关输入、精确命令/日志/二进制摘要、同源码 Terminal 导出文件、浏览器结果、跨页链与实际导出字节、作用域状态。`pnpm test:x06-current` 验证边界和伪闭环拒绝。独立证据 verify.mjs 还校验包含失败记录的外层 manifest。任何输入变化仅使此回执的当前适用性失效，不触发自动全链复验。产品 Audit runtime 已变化，因此本项新建 Web 构建；无关全仓/三轮构建/F05/F07 campaign 不执行。

## 未决与 Gate

工程 `PASS_OWNED_LOCAL_X06_EXECUTION_AUDIT_OPERATIONS` 只针对本次范围。完整 X06 为 `PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS / NOT_READY_GAPS_OPEN`，INTEGRATION stage_gate 仍 `NOT_ASSESSED`，正式接受 false、runtime admission DENIED。DEVELOPMENT 下一原任务为 `CORE-GATE:X3` 当前执行与治理业务闭环评估，不能凭本地 receipt 宣布 X3 或 Beta 通过。

- reference cookie/MFA 身份桥接、loopback TLS/CORS 与内存服务明确标识为测试端口替代；真实 IdP/MFA、RLS、持久 ledger/outbox/原子性、跨进程恢复未执行。未连接 Supabase，未创建本地数据库。
- 本页 C09 Paper 订单和 C11 原生观察分别有各自来源；InspectHealth 不证明 C09/C11 公共 ledger 或真实 F09/X05 观察。InspectEvidence HTTP 正向缺少共同来源；incident resolve HTTP 正向没有受控修复入口，保留 NOT_RUN，不为测试增加绕过入口或注入“已修复”。
- P13 七个独立服务状态/全量遥测、P14 完整签名元数据/历史/审批/导出/领域实时流仍有缺口。现有身份撤权流不等于所有业务实时事件。G4/G5/G6 的完整缺口保留，不能由本次截图关闭。
- elapsedMs 仅诊断，从订单还原证据 ≤5 分钟、全量订单/审批/kill E2E 100% 等原指标未正式验收。Chromium/自动 axe 不代表跨浏览器、人工屏幕阅读器/200% 缩放、性能/长稳或全部可访问性；axe incomplete 必须如实保留。
- 实际目标数据库、真实 venue/testnet/外部网络、部署、安全/性能/长稳、同 SHA 远程 CI 和发布全部 NOT_RUN。无生产凭据、无推送、无外部发布。

人工确认遵守[用户验收确认规程](../gate-records/user-acceptance-confirmation-workflow.md)，工程状态不代替用户接受，也不代替交易业务中的职责分离。
