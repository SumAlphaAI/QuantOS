# UI-P17 当前浏览器页面功能报告（2026-10-22）

`/settings/browser`工程、客户端契约与限定本机组合已实现并验证，状态 IMPLEMENTED_PENDING_ACCEPTANCE。唯一用户确认仍PENDING，INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。只修改QuantOS，在main本地提交，不推送、部署或使用生产凭据。

冻结工程 `dae4d0148439ea06d871caab74d7f2403a36a33a`，1328项输入，`sha256:38dacecae2942f76596f55d380366741f0e0005fcefc0fabb01a2880caeef500`；见[回执](./evidence/ui-p17-local-20261022/receipt.json)、[实际执行](./evidence/ui-p17-local-20261022/function-attempt-01/executions.json)、[完整六维稿](./evidence/ui-p17-local-20261022/confirmation-draft.md)、[失败/尝试历史](./evidence/ui-p17-local-20261022/attempt-history.json)。16项前提只按原需求引用，不递归复验、重新授READY或改绑历史证据；文档/证据提交不意味着新HEAD已接受。

## 实现与范围

- C01顺序会话/context守卫、scope/mode/MFA/settings.read和最早有效期，C17按需读取profile/policy/history，拒绝401/403/404、跨作用域及伪造字段，不向静态HTML输出私有资料，不自动fixture回退。后端history另需audit:read；真实viewer403按拒绝验证。
- 原生通知权限、服务端策略、API存在和实际验证事实分列；通知只在明确点击且secure/default/policy允许时请求，拒绝后禁用，focus/重检重读权限。兼容检测不建立连接、不申请权限、不注册SW、不打开IndexedDB。API、浏览器/OS为当前UA和原生采样，非硬件或连接认证。
- origin-wide存储估算有2秒超时与合法值校验，失败/不支持显示未知。CLEAR LOCAL LAYOUT仅移除quantos.command.layout.v1并读回，失败不确认成功；Cookie、sessionStorage、IndexedDB、Cache、其他键和业务事实不清理，认证秘密不枚举/展示。
- 下载显示已读取数、过滤/空态/有界下一页；拒绝外来/循环cursor、重复ID、历史租约和超限，5页达到上限明确提示并停读，不把限额误作权限失效。只有精确源记录、ready/未过期/路径与策略允许才按手势申请新短链；重复点击、卸载、重载、离线、失效会话和网络后到期不发布。lease exportId绑定、HTTPS同BFF origin、签名路径、无userinfo/query/hash、5分钟及原history期限约束；opaque ticket UUID不等于exportId。临时下载anchor/no-referrer使用后移除，不持久化/记录租约。401清理内存身份并回登录，错误不泄漏provider细节。
- 深链固定本站安全路由/return_to，无账户或token；clipboard成功才提示，拒绝给手动复制，新标签noopener/noreferrer。服务端声明URL仅文本呈现，不用于任意导航。小屏高风险限制、Web-only、离线冻结/重连显式重验与导航裁剪保持。
- browser专属CSS、冻结语义色、已保存主题/密度/对比度/减少动画；1440/1024/390与CSS zoom=2。长日期可视截短，完整偏好时区/UTC值保留title与dateTime。布局清理在存储卡片直接确认，无页面底部独立伪操作。详见[规程](../operations/ui-p17-current-function.md)。

## 测试命令与结果

运行 `node scripts/ui-p17-review.mjs --run docs/audit/evidence/ui-p17-local-20261022/function-attempt-01`；复核 `node scripts/ui-p17-review.mjs --verify`。固定pnpm10.20.0，环境白名单，无目标数据库、全仓coverage或上游campaign。冻结后不更新基线、所有浏览器retry0/skip0/flaky0。

| 检查 | 实际命令 | 结果 | 原始记录 |
|---|---|---|---|
| bff-build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/bff-build.log) |
| unit | `pnpm exec vitest run apps/terminal/tests/ui-p17-runtime.test.ts apps/terminal/tests/browser-platform-provider-consumer.test.ts apps/terminal/tests/ui-p15-runtime.test.ts apps/terminal/tests/ui104-settings.test.ts apps/terminal/tests/ui104-runtime.test.ts apps/terminal/tests/ui104-http.test.ts packages/domain-ui/tests/chrome.test.tsx` | PASS：7文件 / 92项 | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/unit.log) |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/domain-ui --filter @sumalpha/terminal typecheck` | PASS | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/types.log) |
| lint | `pnpm --filter @sumalpha/domain-ui --filter @sumalpha/terminal lint` | PASS | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/lint.log) |
| test-lint | `pnpm exec eslint tests/e2e/ui-p17.spec.ts tests/e2e/ui-p17-http.spec.ts tests/e2e/ui104-bff.spec.ts tests/e2e/fixtures/ui-p17.ts tests/e2e/fixtures/ui104.ts tests/e2e/ui104-settings.spec.ts playwright.config.ts playwright.ui-p17.config.ts scripts/ui-p17-review.mjs scripts/ui-p17-review.test.mjs scripts/ui-p17-browser-environment.mjs` | PASS | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/test-lint.log) |
| negative | `node --test scripts/ui-p17-review.test.mjs scripts/frontend-import-boundary.test.mjs` | PASS：66项（29新门禁+37边界） | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/negative.log) |
| terminal-bff | `pnpm --filter @sumalpha/terminal build` | PASS | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/terminal-bff.log) |
| browser | `pnpm exec playwright test --config=playwright.ui-p17.config.ts tests/e2e/ui-p17.spec.ts --grep-invert visual baseline --project=chromium --project=webkit --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p17-local-20261022/function-attempt-01/browser/results` | PASS：26项 / Chromium+WebKit，附件接收范围见说明 | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/browser.log) |
| local-http | `pnpm exec playwright test --config=playwright.ui-p17.config.ts tests/e2e/ui-p17-http.spec.ts --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p17-local-20261022/function-attempt-01/local-http/results` | PASS：3项 / actual Rust reference；非目标身份/Cookie/CORS | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/local-http.log) |
| regression | `pnpm exec playwright test --config=playwright.ui-p17.config.ts tests/e2e/ui104-bff.spec.ts --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p17-local-20261022/function-attempt-01/regression/results` | PASS：17项 / 既有UI104 BFF消费者 | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/regression.log) |
| visual | `pnpm exec playwright test --config=playwright.ui-p17.config.ts tests/e2e/ui-p17.spec.ts --grep visual baseline --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p17-local-20261022/function-attempt-01/visual/results` | PASS：2项 / 六张P17深浅图冻结比较 | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/visual.log) |
| terminal-mock | `pnpm --filter @sumalpha/terminal build` | PASS | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/terminal-mock.log) |
| mock-regression | `pnpm exec playwright test tests/e2e/ui104-settings.spec.ts --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p17-local-20261022/function-attempt-01/mock-regression/results` | PASS：8项 / 含原Settings两图比较 | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/mock-regression.log) |
| firefox-diagnostic | `node scripts/ui-p01-browser-environment.mjs docs/audit/evidence/ui-p17-local-20261022/function-attempt-01/firefox-environment.json` | 诊断完成；启动超时，功能BLOCKED_ENVIRONMENT | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/firefox-diagnostic.log) |
| webkit-attachment-diagnostic | `node scripts/ui-p17-browser-environment.mjs docs/audit/evidence/ui-p17-local-20261022/function-attempt-01/webkit-attachment-environment.json` | 诊断完成；实际环回附件PASS，拦截附件事件FAILED/功能NOT_RUN | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/webkit-attachment-diagnostic.log) |
| baselines | `node scripts/check-visual-baselines.mjs` | PASS：48项静态登记完整性 | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/baselines.log) |
| plans | `node scripts/check-development-plans.mjs` | PASS：计划结构/依赖 | [日志](./evidence/ui-p17-local-20261022/function-attempt-01/plans.log) |

92单元/组合含21项新增P17与10项平台消费者、61项既有设置/共享Chrome。66门禁/边界负向防止假命令、缺报告、跳过/重试/错误、READY/批准/发布越级和环境失败冒记PASS。56浏览器案例为26项P17、3项actual Rust参考组合、17项UI104直接回归、2项P17六图比较及8项原mock回归（2旧图）。12组双主题/三宽度/双浏览器axe违规0，incomplete共12项：{'color-contrast': 12}，原样保留，非人工读屏通过。

实际Rust组合由冻结源码构建的参考BFF与内存种子提供者运行。通过真实MFA→reauth→export API准备未过期自有导出，安全响应证据仅hash、不存验证引用；浏览器身份/CORS测试桥逐字节转发服务响应。验证读取、viewer history403、invalid session401及不可信租约拒绝。没有把参考数据准备或桥接当成真实IdP、Cookie/CORS、DB持久性或完整联调通过。

六张P17当前Chromium/Darwin图覆盖顶部、storage/deep-link、responsive三位置/双主题，Codex已复核代表性图片。旧browser Darwin图迁移，旧security Darwin图字节不变；原catalog/两张图按3c4f99f0字节存入[原件](./evidence/ui-p17-local-20261022/legacy-visual-before/)，见[迁移](./evidence/ui-p17-local-20261022/visual-migration.json)。48项登记PASS只证明文件/hash完整；初始化不是独立设计签署，其他OS/browser比较NOT_RUN。

## 未决风险与Gate

Firefox 独立启动10秒超时，环境 BLOCKED_ENVIRONMENT，浏览器功能 NOT_RUN。WebKit 在产品外独立验证真实环回HTTP附件可接收，同源及HTTPS route.fulfill附件均200但下载事件超时；当前产品WebKit只验到签名内容响应，拦截附件接收 BLOCKED_ENVIRONMENT_TEST_INTERCEPTION / NOT_RUN。三次原超时和最终诊断保留；Chromium附件实际落盘4字节与fixture一致。不能将WebKit导航成功当附件交付成功。

Rust reference 原下载租约是 downloads.invalid/query-ticket，被前端签名路径/同源约束安全拒绝；actualReferenceDownloadDelivery NOT_RUN。live 服务采用terminal origin，当前消费者限定BFF origin，目标部署拓扑兼容与可能的接口修正须在后续明确范围核验；未放宽为任意URL信任，也未用重写桥接响应宣称投递成功。此项是G1本机组合/目标联调的已知缺口。

真实IdP/MFA、目标BFF/数据库、Cookie/CORS、目标持久撤销、身份注册恢复码、原生通知投递、CSP/SRI/日志脱敏与Cookie属性、真实设备、人工读屏、原生200%、跨OS图像、远程同SHA CI、性能/容量/长稳和RELEASE全部NOT_RUN。HTTP快照未开启实时设置/撤权推送，网络恢复与最早session/context到期需重验。API presence只代表存在，不代替连接/授权或硬件验证。最多5页/500条是本次读取上限，不声称完整下载总量。

初次preflight-01的两次types执行复用了日志路径，首次原字节被覆盖；现存第二次原失败、工具输出摘要与[记录边界](./evidence/ui-p17-local-20261022/preflight-01/recording-note.md)明确保留，不冒称全量原始日志完整。其余后续失败/超时、原基线和冻结候选证据独立留存；最终门禁不复用任何预检PASS。

工程PASS、客户端契约PASS、受控本机组合PASS_REFERENCE_FIXTURES_ONLY，仅以上明确范围。确认PENDING、INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。P01/P02已确认原范围和P15待确认均不改写、不提升。下一可执行任务 FRONTEND-GATE:G1 / FEP-1 本机联调缺口核对，优先梳理下载reference/live origin链路和已有未决确认；不能凭本页结果直接给G1 READY。

## 工程变更文件

- `apps/terminal/app/settings/_components/p17-browser-panel.tsx`
- `apps/terminal/app/settings/_components/p17.css`
- `apps/terminal/app/settings/_components/ui104-settings-workspace.tsx`
- `apps/terminal/src/settings/browser-probes.ts`
- `apps/terminal/src/settings/c17.ts`
- `apps/terminal/src/settings/gateway.ts`
- `apps/terminal/src/settings/platform.ts`
- `apps/terminal/src/settings/runtime.ts`
- `apps/terminal/tests/browser-platform-provider-consumer.test.ts`
- `apps/terminal/tests/ui-p17-runtime.test.ts`
- `docs/operations/ui-p17-current-function.md`
- `playwright.config.ts`
- `playwright.ui-p17.config.ts`
- `scripts/ui-p17-browser-environment.mjs`
- `scripts/ui-p17-review.mjs`
- `scripts/ui-p17-review.test.mjs`
- `tests/e2e/fixtures/ui-p17.ts`
- `tests/e2e/ui-p17-http.spec.ts`
- `tests/e2e/ui-p17.spec.ts`
- `tests/e2e/ui-p17.spec.ts-snapshots/p17-browser-1440-dark-chromium-darwin.png`
- `tests/e2e/ui-p17.spec.ts-snapshots/p17-browser-1440-light-chromium-darwin.png`
- `tests/e2e/ui-p17.spec.ts-snapshots/p17-browser-responsive-1440-dark-chromium-darwin.png`
- `tests/e2e/ui-p17.spec.ts-snapshots/p17-browser-responsive-1440-light-chromium-darwin.png`
- `tests/e2e/ui-p17.spec.ts-snapshots/p17-browser-storage-1440-dark-chromium-darwin.png`
- `tests/e2e/ui-p17.spec.ts-snapshots/p17-browser-storage-1440-light-chromium-darwin.png`
- `tests/e2e/ui104-bff.spec.ts`
- `tests/e2e/ui104-settings.spec.ts-snapshots/ui104-browser-1440-dark-chromium-darwin.png`
- `tests/e2e/visual-baselines.json`

最终文档/证据提交另包含本报告、计划状态、六维稿、原始任务、环境诊断/失败/输入/日志/回执/索引和9个Playwright原始错误上下文的精确路径空白检查豁免；[完整工程清单](./evidence/ui-p17-local-20261022/changed-files.json)。
