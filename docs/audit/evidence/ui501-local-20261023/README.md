# UI-501 Portfolio 与 Risk 本机功能证据

最终有界结果：`PASS_UI501_REFERENCE_FUNCTION`。冻结源码 `6a3bd2de971a0037fe2c0ee6904dda98f475e616`，有效原始回执 `receipt.json` / `attempt-03/`。复核：

```sh
node scripts/ui501-review.mjs --verify
```

执行命令 `node scripts/ui501-review.mjs --run docs/audit/evidence/ui501-local-20261023/attempt-03`。该入口使用净化环境、离线 Cargo、本机合成 BFF、显式回环 TLS/身份/CORS 替代；不读取生产凭据、不连接真实数据库、不推送、不部署。所有 argv、时间、exit、日志哈希、二进制哈希、输入清单、构建产物哈希与网络记录见 `attempt-03/executions.json` 和 `receipt.json`。

| 检查 | 结果 |
| --- | --- |
| DEVELOPMENT FE:UI-501 | allowed=true，FUNCTION_AND_IMPACT_SCOPE |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS |
| Vitest 生成消费者/当前功能/直接路由与导航回归（完整文件 argv 见 executions.json） | 111 PASS，0 failed/skipped |
| `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 20 PASS |
| `cargo test --locked --offline -p bff-gateway --lib operations::tests::` | 20 PASS |
| terminal typecheck / 变更范围 ESLint | PASS |
| `node --test scripts/ui501-review.test.mjs` | 5 PASS（拒绝伪造/越界/篡改回执） |
| `pnpm --filter @sumalpha/terminal build` | PASS；portfolio/risk 静态页与 client-secrets 检查通过 |
| `pnpm exec playwright test --config=playwright.ui501.config.ts --project=chromium --workers=1 --retries=0` | 10 PASS；无重试/跳过/抖动 |
| 1440/390 × dark/light axe/截图 | 4 scans，0 violations；desktop 各 1 color-contrast incomplete，均为 10 个非文本导航图标（共 2 组/20 nodes），未冒充完整人工无障碍验收 |
| `node scripts/check-development-plans.mjs` | PASS |
| `node scripts/development-execution.mjs --integration FE:UI-501` | 预期 exit=1，allowed=false，不提升 INTEGRATION |
| `node scripts/development-execution.mjs --development FE:UI-P08` | exit=0，allowed=true |

实现 `/portfolio`、`/risk`；仓位、精确 P&L/敞口、asOf/stale、同帧规则/Kill 状态、C16 风险告警、MFA/重新认证、成功/拒绝/恢复已验证。未知结果立即禁写并标记待核查；显式重读不重发，原请求恢复保留 body/key/proof。实际消费者验证 Operator 启用、Owner 解除、Operator 解除 403、外账户 404、Viewer 403、伪造 step-up 403、独立消费者接收 Kill 更新。合成单元还验证时间阈值、失效/撤权、断流/gap、回退、并发、429、错误回执、GlobalKill 保持启用与十进制边界。

## 保留失败

- `development/`：冻结前诊断 `ORIGINAL_SCOPE_ONLY`。首次 36 项中 35 PASS/1 FAIL，撤权测试的 sequence=0 不符合生成契约，改为有效的旧序号1。参考消费者前两次因记录器重复消费 POST Request body 未到服务端，修复后实际提交/丢失响应/原键恢复通过。初始类型问题 nullable cursor、MFA challenge 无 expiresAt、spawn NODE_ENV 已修正；计划检查曾因 README 尚未创建拒绝，未记 PASS。
- `attempt-01/`，源码 `040bf46a`：109 Vitest、C06/C16 各20、构建通过；Chromium 6 PASS/4 FAIL。动作 select 隐式标签匹配失败三项，logout 控制请求发送契约不接受的 body 一项。后续 plans/integration/next NOT_RUN。原始范围与哈希见 `attempt-01-result.json`。
- `attempt-02/`，源码 `14b8d335`：110 Vitest、C06/C16 各20、构建通过；Chromium 7 PASS/3 FAIL。实际启用/丢失响应已发生，textarea 已填写内容进入隐式标签名称，导致两次再次编辑和一次锁定状态定位失败。后续 checks NOT_RUN。见 `attempt-02-result.json`。
- 最终 `attempt-03/` 从新的冻结源码完整运行，未拼接旧 PASS。原始错误 Markdown 和空白诊断仅按精确路径添加 `.gitattributes -whitespace`，保留原字节。

## 阶段、限制与下一任务

开发状态 `IMPLEMENTED_PENDING_ACCEPTANCE`；stage gate `INTEGRATION/NOT_ASSESSED`，`formalAccepted=false`、`runtimeAdmission=DENIED`。目标数据库/RLS/事务、真实 IdP/cookie/CORS、真实组合/风控源、目标持久恢复、多浏览器/跨OS、人工读屏/native200%、远程同SHA CI、性能容量长稳、完整I4/RELEASE 均 NOT_RUN。参考 BFF 的有限 journal 轮询不证明目标长期 SSE 可用性。C06 无估值/逐仓 P&L/敞口单位/规则明细或 kill CAS 条件，界面不伪造数据或权限。

未执行 P08 高保真/规则详情；下一可执行任务 **FE:UI-P08**。功能与风险说明见 [UI501操作文档](../../../operations/ui501-portfolio-risk.md)，交付清单见 [DELIVERY.md](./DELIVERY.md)、[changed-files.txt](./changed-files.txt)。`delivery-manifest.json` 逐文件封存本目录除自身外的全部内容；历史失败适用范围保留，不能改绑为当前 PASS。
