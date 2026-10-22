# UI-507：Audit Explorer 与受控导出

本任务是原计划 I2 UI-507 的功能开发。开发入口为 `node scripts/development-execution.mjs --development FE:UI-507`；G1-DEP-01、历史确认及环境待办不作为前置。已确认且影响本功能的缺陷仍须修复。禁止将本轮本机结果记作 G1/FEP-1 完整联调、目标环境、发布或正式 ACCEPTED。

## 功能范围

- `/audit` 使用生成 C10 客户端执行服务端搜索：correlation、causation、对象、类型、时间范围和每页条数；游标只承接同一已提交查询，更换查询重置游标。拒绝重复事件、游标循环、过期记录和超限页。最多继续读取49页，达到上限后重新搜索。
- correlation/causation、脱敏载荷、事件哈希、保留期和按需分页的证据链可见；只依据服务端 `complete` 标记声明“当前授权范围内链完整”，不声明跨权限、全局完整。父事件未在已加载范围内时明确标记。证据链最多2000条，20次游标读取；重新读取不会绕过授权。
- `/exports` 支持显式范围、JSONL/CSV/PDF、理由、水印、1–30天保留期。`/audit?correlationId=<UUID>` 和 `/exports?exportId=<UUID>` 为静态导出的资源引用入口。原 UI-P12 的高保真页面与 `/audit/:correlationId`、`/exports/:exportId` 路径映射由下一原任务交付；本轮不宣称完成 UI-P12。
- 创建/取消前检查 `audit:export`、桌面宽度、在线、有效会话、CSRF。每次用户提交经 MFA → 短时 reauth → C10 command；每一步重新检查当前访问条件。取消前重新读取作业；C10无对象版本参数，由服务端作最终状态与幂等校验。
- queued/generating/cancel_requested 与最终状态分别展示；不把202受理当作文件就绪。用户显式查询状态，页面不自动重放写操作。未知创建结果锁定原请求内容，显式相同意图重试复用幂等键；未知取消由服务端状态读取解决或原键重试。页面关闭后不持久化意图和令牌，恢复从读取事实开始；未知创建在离开页面后应通过审计查询确认再创建。
- 只在 ready 且未到保留期限时显式申请下载。复用既有严格 HTTPS 同 BFF origin、opaque路径、最长300秒/保留期约束；不改写下载 URL。临时 anchor 使用 no-referrer，点击后立即移除。页面只报告交给浏览器与预期哈希/大小，不声称浏览器接收成功。reference真实附件接收在浏览器测试中单独断言。服务端继续强制授权、水印、一次性消费和下载审计。
- 复用 `createRouteAccess`：session/context一致、实时撤权通道、权限再核对、期限、离线/隐藏/焦点及跨标签失效。失效清空页面、草稿和内存幂等意图，AbortSignal 中止所有请求；显式重新验证只重新读取。事件保留期参与页面授权期限。
- 小屏开放审计查询和授权下载，不展示创建/取消高风险操作。桌面和移动端基本可用性为本轮功能验证，高保真、完整视觉、读屏器和原生200%缩放仍按原任务/边界记录。

## 有界验证与证据

`node scripts/ui507-review.mjs --run docs/audit/evidence/ui507-local-20261022/attempt-02` 在已提交 main 工程候选执行：reference二进制单次离线构建；本功能、C10消费者及复用访问监控的直接单测/恢复；Terminal类型、局部lint、一次Terminal构建/客户秘密扫描；六个Chromium实际路由用例；门禁负例、计划一致性、联调入口预期拒绝和下一 UI-P12 开发入口。没有全仓 campaign、数据库测试、上游验收递归或G1完整旅程重跑。

`node scripts/ui507-review.mjs --verify` 核对当前功能源码与 Git 候选绑定、日志/产物哈希、55个直接功能测试、6个浏览器用例、159个原阶段Gate未提升、旧证据文件原范围摘要及下一任务入口。新增源码后旧结果不自动改绑。

本机浏览器拓扑：Terminal静态页3190 → HTTPS loopback4010 → 当前 Rust reference BFF临时端口。代理注入明示 reference cookie 并替代 CORS；API响应与附件原字节透传，下载URL不改写。MFA、reauth、搜索、创建、状态、取消、下载签发/内容/审计由 Rust reference 实际执行；真实IdP、真实cookie/CORS、目标持久层仍 NOT_RUN。

复用 `g1-download-local-20261022`、`g1-recovery-local-20261022`、`g1-journey-local-20261022` 及 `fep1-function-local-20261022` 原始回执；保留其源码 SHA 与适用范围。本轮仅校验文件摘要和原引用，不重新验收旧依赖链，不改绑历史 PASS。`g1-journey-local-20261022/retained-boundaries.json` 的全部 NOT_RUN、Firefox环境阻塞、WebKit拦截附件接收阻塞及附加未执行项原字节保留；新的 UI-507 reference 创建界面证据不覆盖历史完整未替代旅程 NOT_RUN。

## Gate 与下一任务

功能工程门禁 `PASS_UI507_LOCAL_FUNCTION`；计划 `development_status=IMPLEMENTED_PENDING_ACCEPTANCE`，完整确认稿另存本轮报告，未代用户确认。`stage_gate` 保持 `INTEGRATION / NOT_ASSESSED`；G1/FEP-1完整联调与发布状态不提升。下一可执行原任务为 I2 `UI-P12`，其开发入口无需先关闭辅助G1事项或等待本轮正式确认。
