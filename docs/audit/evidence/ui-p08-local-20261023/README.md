# UI-P08 Portfolio 与 Risk 高保真页面证据

最终有界工程 Gate：`PASS_P08_REFERENCE_FUNCTION`。冻结源码 `4ed8a29506774812f265ce442ca6049d34faf020`；有效回执 `receipt.json`，原始命令/日志/构建/网络/截图位于 `attempt-03/`。复核入口：

```sh
node scripts/ui-p08-review.mjs --verify
```

实际运行 `node scripts/ui-p08-review.mjs --run docs/audit/evidence/ui-p08-local-20261023/attempt-03`。13组命令使用净化环境、离线 Cargo、固定公开测试 MFA/合成账户、显式回环 TLS/身份/CORS 替代。未读取生产凭据，未连接真实数据库，未推送或部署。原始 argv、起止时间、exit、信号、日志哈希、源码输入、二进制/构建产物哈希见 `executions.json`、`inputs.json`、`receipt.json`。

| 命令/检查 | 结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-P08` | allowed=true |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS |
| `pnpm exec vitest run` 当前功能/生成消费者与直接相关回归（9个文件，完整argv见 executions.json） | 127 PASS，0 fail/skip |
| `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 20 PASS |
| C16 `operations::tests::stream_resume_is_dense_bound_to_subscriptions_and_never_masks_gaps` | 1 PASS，未递归复验完整上游 |
| `pnpm --filter @sumalpha/terminal typecheck` / 变更范围 ESLint | PASS |
| `node --test scripts/ui-p08-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | 20 PASS |
| `pnpm --filter @sumalpha/terminal build` | PASS；client-secrets检查通过，Portfolio/Risk真实导出文档 |
| `pnpm exec playwright test --config=playwright.ui-p08.config.ts --project=chromium --workers=1 --retries=0` | 15 PASS，无重试/跳过/抖动 |
| 三路由 × dark/light × 1672/1024/390 截图与 axe | 18 scans，0 violations；12组 color-contrast incomplete，均为非文本导航图标，合计120nodes；人工无障碍未冒充PASS |
| `node scripts/check-development-plans.mjs` | PASS |
| `node scripts/development-execution.mjs --integration FE:UI-P08` | 预期 exit=1、allowed=false；不提升阶段 |
| `node scripts/development-execution.mjs --development FE:UI-502` | exit=0、allowed=true |

## 实际范围

- `/portfolio`、`/risk`、严格 UUID `/risk/rules/:ruleId`，参考 P08 的主工作区/右风险栏、六指标卡、权益、仓位、敞口、预算、当前规则与详情结构；明暗/桌面/平板/移动布局。规则详情仅绑定当前授权账户命中引用，未知 UUID 说明不可用，恶意路径/查询拒绝，不虚构规则接口。
- 精确 MoneyValue/DecimalValue 与 asOf；实际仓位筛选、方向/排序/密度、只读详情、视图偏好白名单。权益/估值/分项/阈值/热图数据缺失时显示不可用，不展示设计稿演示数字、曲线或预算百分比。未提供报告下载或关联对象引用时禁用。
- 当前风险规则观察最多20条，保留实际读到的快照/版本；asOf 不冒充命中发生时间。C16风险告警保持独立账户/模式/域校验和分页提示。
- 共用 DangerConfirmDialog 的取消焦点/焦点约束/短语/MFA/pending，真实参考 Operator启用、Owner解除、Operator解除403、外部账户Kill广播、未知结果先读后原body/key/proof恢复。陈旧、断流、离线/撤权、伪造账户、格式错误均拒绝写；流错误保留安全关联ID。固定底栏Kill状态在移动规则详情仍可见。

## 设计/视觉复核

参考图片及哈希由 receipt 绑定：[设计稿](../../../../design/P08-Portfolio-and-Risk-High-Fidelity-v1.png)。详见 [VISUAL-REVIEW.md](./VISUAL-REVIEW.md)。自动几何证明1672px主区/风险栏同顶且不重叠，1024px风险区下移，390px单列且文档无横向溢出；表格仅在自身容器滚动。规则移动导航聚焦标题并滚至可读位置，底栏仍显示Kill。18张图是相应来源状态的视觉证据，非与设计稿示例数字逐像素一致的声明。

## 历史与失败

- `development/`：冻结前呈现/运行时57项通过；受限沙箱静态宿主监听回环 EPERM，属于环境拒绝，不记产品通过，后续授权本机回环宿主矩阵实际通过。
- `attempt-01/` 源码 `c3a4380f`：127 Vitest、C06 20/C16 1、Node20与构建通过；Chromium12 PASS/3 FAIL。原因：在正确modal inert期间读取背景权限提示、未区分Next.js空alert、键盘断言把已填写MFA后的焦点当作初始取消焦点。18组axe无违规；后续plans/integration/next未执行，NOT_RUN。原始日志、截图与 `attempt-01-result.json` 保留。
- `attempt-02/` 源码 `3969466d`：全部矩阵通过，标记 `PASS_ORIGINAL_SCOPE_ONLY`。截图复核发现移动规则区需固定底栏Kill状态，源码变化后此PASS不改绑。原始根回执/结果字节归档于 `attempt-02-receipt.original.json` / `attempt-02-gate-result.original.json`。
- `attempt-03/` 从新源码完整执行，未拼接历史PASS。`.gitattributes` 仅对具体原始失败Markdown/空白诊断豁免空白检查，不重写原字节。UI501及其他历史证据未修改。

## Gate、风险与交接

`IMPLEMENTED_PENDING_ACCEPTANCE`，INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。真实目标IdP/cookie/CORS、数据库/RLS/事务、真实组合/风控源与持久恢复、长期SSE、Firefox/WebKit/跨OS、人工读屏/native200%、远程同SHA CI、性能容量长稳、完整I4/RELEASE仍NOT_RUN。

当前C06不含完整估值/权益历史/预算阈值/规则定义与完整命中历史、受控组合报告；C01不含细分风险写角色能力。界面不补造数据、签名或读写授权。这些来源缺口不记为已完成目标验收。下一可执行任务 **FE:UI-502：Proposal 与风险评估**。

详见 [操作说明](../../../operations/ui-p08-portfolio-risk.md)、[交付报告](./DELIVERY.md)、[变更清单](./changed-files.txt)。`delivery-manifest.json` 封存本目录除自身外全部文件；历史结果原适用范围不变。
