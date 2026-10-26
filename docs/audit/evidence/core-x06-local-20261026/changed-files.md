# CORE:X06 变更文件

基线：`9a02807f94faccc407ff7025ce9f5df248d97aa1`；最终源码：`1a7e745bc8941bf76d32f3753de172de214dd13f`。

| 文件 | 内容 |
| --- | --- |
| `apps/terminal/src/audit/runtime.ts` | 固定会话授权/最短期限、MFA 前重新验证、401/403/本地监视器失效清除未知意图，暂时拒绝保持原键 |
| `apps/terminal/tests/audit-runtime.test.ts` | 新增 8 项边界/恢复回归，当前 26 项 |
| `docs/SumAlpha-QuantOS-Development-Plan.md` | 同步 X06 当前功能状态/独立 Gate/缺口/证据/下一原项 |
| `docs/operations/core-x06-current-function.md` | 当前范围、运行/复核、端口替代和未执行边界 |
| `docs/operations/service-x06.md` | CORE Web 使用独立当前功能入口，不继承旧 SERVICE 全 campaign |
| `package.json` | 新增 assess/check/test:x06-current |
| `playwright.config.ts` | 专用 X06 套件不进入通用矩阵 |
| `playwright.x06.config.ts` | 专用无重试顺序 Chromium 场景 |
| `scripts/core-x06-review.mjs` | 21 组检查、白名单环境、冻结输入/结果/构建/字节校验及状态拒绝 |
| `scripts/core-x06-review.test.mjs` | 工程边界与虚假闭环的负向校验 |
| `tests/e2e/fixtures/x06-reference.ts` | 同实例实际 Rust BFF、显式身份/TLS替代、丢失响应/非JSON拒绝、外部请求记录与签名脱敏 |
| `tests/e2e/x06-integration.spec.ts` | 实际跨 P08–P14 Paper 流程、Assisted 模式拒绝、Audit 403 清除 |

额外新增证据：`docs/audit/evidence/core-x06-local-20261026/` 下 README、commands、changed-files、acceptance-draft、receipt、manifest、只读 verify、3 个 preflight、4 个 attempt 及 attempt-03 原范围回执。所有历史失败/排除/NOT_RUN 原样保留。

本地源码提交：

- `1a7e745b fix(audit): discard export intent on local authority invalidation during reload`
- `27319928 test(x06): select current P08 danger confirmation regressions`
- `15bb5691 test(x06): type audit fixture and select actual operations scenarios`
- `ae66bbac feat(terminal): bind X06 audit authority and verify execution operations journey`

没有分支/worktree、远端推送、部署或外部发布。
