# UI-P15 当前页面功能报告（2026-10-22）

P15三分区页面工程、客户端契约与受控本机组合通过，状态 `IMPLEMENTED_PENDING_ACCEPTANCE`；完整稿PENDING，INTEGRATION NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。只修改QuantOS，在main本地提交，未推送、部署或使用生产凭据。

最终冻结工程 `7bb249d86c807503f31b7aa0275882ca28d1be46`，1321项输入，`sha256:5bee572f67989c4526e28b891d316f074ade00296f0152e8ce930dab76203ae6`。见[机器回执](./evidence/ui-p15-local-20261022/receipt.json)、[输入与实际执行](./evidence/ui-p15-local-20261022/function-attempt-02/)、[完整六维稿](./evidence/ui-p15-local-20261022/confirmation-draft.md)、[尝试历史](./evidence/ui-p15-local-20261022/attempt-history.json)。原d3623b82成功回执保持原SHA，后续布局修正不改绑历史通过；最终验证来自独立function-attempt-02。16项前提只冻结原计划需求引用，不递归复验或授予新READY。后续文档/证据提交不等于新HEAD接受。

## 当前实现

- `/settings/profile`：资料、服务端原时区、语言、数字格式、UTC+Local/Local、主题、密度、对比度与减少动画；白名单/CSRF/CAS/幂等保存，200后更新基线，未保存状态和分区重置。日期按实际偏好格式化且保留原时间戳。完整英文界面后续完善；预览限定当前设置页，未宣称所有业务页面已应用全局偏好。
- `/settings/notifications`：有界通知矩阵、跨午夜静默、Critical绕过和摘要偏好保存；无服务端发出时间便不写08:00；Desktop只为跨端偏好。原生权限仅点击请求，拒绝/不支持降级站内且不重复弹窗；原生投递另记NOT_RUN。静默控件与保存入口在1440默认视口内可见，手机内滚表格可通过键盘聚焦。
- `/settings/security`：MFA/会话/可信设备事实读取，当前及最后因素保护；短语/六位码→C01 security_change→reauth→C17撤销。202只显示受理，资源保留/pending并抑制重复，读取核验最终状态；过去的trustedUntil标为信任已过期。新增独立近期身份验证，仅执行C01两步，不发DELETE，不向视图返回验证引用；审计链接按audit:read裁剪。
- 新增身份因素、恢复代码和密码管理继续沿用UI104已确认的组织身份服务边界；当前C17没有秘密签发/注册/下载操作，只提供明确管理说明，不虚构接口成功。不能将读取/撤销/近期验证当作注册或恢复码验收。

顺序session/context守卫保留，期限取两者最早值，拒绝跨作用域/过期/缺权限；按分区读取，无无关私有读取。非法CSRF cookie不使页面崩溃且不能授权写入；返回外部member成功响应不发布。冲突重新读取和网络恢复保留草稿；无效草稿比较/刷新不抛错，保存仍严格校验。409需显式重读后再保存；未知结果重试保留原幂等键/版本；429按retryAfter暂停、缺值保护等待30秒，不自动提交。离线/小屏冻结高风险、重验后再开放；草稿仅页面内存，离开/关闭会丢失，未持久化MFA码、身份或业务事实。

界面复用冻结语义token、深浅主题、1440/1024/390和CSS zoom=2。设置页共享Chrome取消无来源的Live/Normal/通知3及导航示例计数，回归P17 Browser消费者，仅记录受影响范围，不把UI-P17任务提前关闭。详见[规程](../operations/ui-p15-current-function.md)。

## 测试命令与结果

运行 `node scripts/ui-p15-review.mjs --run docs/audit/evidence/ui-p15-local-20261022/function-attempt-02`；复核 `node scripts/ui-p15-review.mjs --verify`。固定pnpm10.20.0；白名单公开环境，非mock profile显式mock=false/origin=https://bff.ui104.test，浏览器拦截或实际环回reference BFF；独立mock profile仅作既有直接回归。无目标数据库、全仓覆盖率或依赖campaign。

| 检查 | 实际命令 | 结果 | 原始记录 |
|---|---|---|---|
| bff-build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/bff-build.log) |
| unit | `pnpm exec vitest run apps/terminal/tests/ui-p15-runtime.test.ts apps/terminal/tests/ui104-settings.test.ts apps/terminal/tests/ui104-runtime.test.ts apps/terminal/tests/ui104-http.test.ts packages/domain-ui/tests/chrome.test.tsx` | PASS：5文件 / 61项 | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/unit.log) |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/domain-ui --filter @sumalpha/terminal typecheck` | PASS | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/types.log) |
| lint | `pnpm --filter @sumalpha/domain-ui --filter @sumalpha/terminal lint` | PASS | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/lint.log) |
| test-lint | `pnpm exec eslint tests/e2e/ui-p15.spec.ts tests/e2e/ui-p15-http.spec.ts tests/e2e/ui104-bff.spec.ts tests/e2e/fixtures/ui-p15.ts tests/e2e/fixtures/ui104.ts tests/e2e/ui104-settings.spec.ts playwright.config.ts playwright.ui-p15.config.ts scripts/ui-p15-review.mjs scripts/ui-p15-review.test.mjs` | PASS | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/test-lint.log) |
| negative | `node --test scripts/ui-p15-review.test.mjs scripts/frontend-import-boundary.test.mjs` | PASS：61项（24新门禁+37边界） | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/negative.log) |
| terminal-bff | `pnpm --filter @sumalpha/terminal build` | PASS | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/terminal-bff.log) |
| browser | `pnpm exec playwright test --config=playwright.ui-p15.config.ts tests/e2e/ui-p15.spec.ts --grep-invert 'visual baseline' --project=chromium --project=webkit --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p15-local-20261022/function-attempt-02/browser/results` | PASS：34项 / Chromium+WebKit | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/browser.log) |
| local-http | `pnpm exec playwright test --config=playwright.ui-p15.config.ts tests/e2e/ui-p15-http.spec.ts --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p15-local-20261022/function-attempt-02/local-http/results` | PASS：6项 / actual Rust reference，测试身份/CORS桥接 | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/local-http.log) |
| regression | `pnpm exec playwright test --config=playwright.ui-p15.config.ts tests/e2e/ui104-bff.spec.ts --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p15-local-20261022/function-attempt-02/regression/results` | PASS：17项 / 原UI104 BFF消费者 | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/regression.log) |
| visual | `pnpm exec playwright test --config=playwright.ui-p15.config.ts tests/e2e/ui-p15.spec.ts --grep 'visual baseline' --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p15-local-20261022/function-attempt-02/visual/results` | PASS：2项 / P15六张深浅像素比较 | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/visual.log) |
| terminal-mock | `pnpm --filter @sumalpha/terminal build` | PASS | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/terminal-mock.log) |
| mock-regression | `pnpm exec playwright test tests/e2e/ui104-settings.spec.ts --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p15-local-20261022/function-attempt-02/mock-regression/results` | PASS：8项 / 含原Settings两图比较 | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/mock-regression.log) |
| firefox-diagnostic | `node scripts/ui-p01-browser-environment.mjs docs/audit/evidence/ui-p15-local-20261022/function-attempt-02/firefox-environment.json` | 诊断退出0；实际启动TimeoutError，功能BLOCKED_ENVIRONMENT | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/firefox-diagnostic.log) |
| baselines | `node scripts/check-visual-baselines.mjs` | PASS：42项静态登记完整性 | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/baselines.log) |
| plans | `node scripts/check-development-plans.mjs` | PASS：计划结构/依赖 | [日志](./evidence/ui-p15-local-20261022/function-attempt-02/plans.log) |

最终61单元/组合、61门禁/边界、67浏览器用例：34为17项P15×Chromium/WebKit，6为浏览器到actual Rust reference C01/C17，17为原UI104 BFF回归，2为六张新P15视觉，8为原mock回归含两张旧图比较。所有浏览器retry0、skip0、flaky0；8张像素比较仅Darwin Chromium。36组P15三页/双主题/三视口/双浏览器axe扫描违规0，incomplete 36项：{'color-contrast': 36}，原样保留不等于人工读屏通过；CSS zoom=2不替代原生200%。

本机组合包括资料/区域/通知保存后读取、会话/设备/因素实际撤销与读取、近期验证、只读、未登录及缺CSRF拒绝。服务进程是已构建的Rust BFF，种子内存提供者；测试身份/CORS桥接转发响应原字节，安全响应证据仅hash、不留秘密。**这些不是目标IdP、真实浏览器Cookie/CORS、数据库持久撤销或完整业务联调验收。**

视觉登记42项PASS只验证登记/文件hash。原UI104两张Darwin Chromium图与原catalog按a4a0d9f8字节另存[原件](./evidence/ui-p15-local-20261022/legacy-visual-before/)，迁移见[记录](./evidence/ui-p15-local-20261022/visual-migration.json)；其余平台/browser历史图不重录、不声称当前通过。六张新P15图先初始化，后最终冻结候选禁止更新比较，初始化不作独立设计签署。Codex已检查三页代表性双主题截图，保留初次失败和布局复核修正历史。

## 风险及Gate

Firefox独立10秒启动超时，功能 `BLOCKED_ENVIRONMENT`；诊断脚本退出0只代表诊断完成。真实IdP/MFA、目标BFF/数据库、持久目标撤销、真实浏览器Cookie/CORS、原生通知投递、新身份因素/恢复码、人工读屏、原生200%、跨OS视觉、远程同SHA CI、性能/容量/长稳和RELEASE均NOT_RUN。

HTTP设置快照未开启SSE；权限在刷新/到期/重连时重验，未宣称实时撤权推送。用户草稿仅内存；语言、主题预览与其他业务页全局展示仍有上述范围限制。组织身份管理操作不在当前C17契约，不能推断实际注册/恢复码已验收。

工程PASS、客户端契约PASS、受控本机组合PASS_REFERENCE_FIXTURES_ONLY；确认PENDING，INTEGRATION NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。原P01/P02/UI104等确认与原证据不改写、不提升；没有代用户批准。下一可执行开发任务 **FE:UI-P17 / I1**。

## 工程变更文件

- `apps/terminal/app/settings/_components/p15.css`
- `apps/terminal/app/settings/_components/ui104-settings-route.tsx`
- `apps/terminal/app/settings/_components/ui104-settings-workspace.tsx`
- `apps/terminal/src/settings/gateway.ts`
- `apps/terminal/src/settings/presentation.ts`
- `apps/terminal/src/settings/runtime.ts`
- `apps/terminal/tests/ui-p15-runtime.test.ts`
- `docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md`
- `docs/audit/UI-P15-current-function-review-2026-10-22.md`
- `docs/operations/ui-p15-current-function.md`
- `playwright.config.ts`
- `playwright.ui-p15.config.ts`
- `scripts/ui-p15-review.mjs`
- `scripts/ui-p15-review.test.mjs`
- `tests/e2e/fixtures/ui-p15.ts`
- `tests/e2e/ui-p15-http.spec.ts`
- `tests/e2e/ui-p15.spec.ts`
- `tests/e2e/ui-p15.spec.ts-snapshots/p15-notifications-dark-chromium-darwin.png`
- `tests/e2e/ui-p15.spec.ts-snapshots/p15-notifications-light-chromium-darwin.png`
- `tests/e2e/ui-p15.spec.ts-snapshots/p15-profile-dark-chromium-darwin.png`
- `tests/e2e/ui-p15.spec.ts-snapshots/p15-profile-light-chromium-darwin.png`
- `tests/e2e/ui-p15.spec.ts-snapshots/p15-security-dark-chromium-darwin.png`
- `tests/e2e/ui-p15.spec.ts-snapshots/p15-security-light-chromium-darwin.png`
- `tests/e2e/ui104-settings.spec.ts-snapshots/ui104-browser-1440-dark-chromium-darwin.png`
- `tests/e2e/ui104-settings.spec.ts-snapshots/ui104-security-1440-dark-chromium-darwin.png`
- `tests/e2e/visual-baselines.json`

最终报告、计划及原始验收证据补齐在文档/证据提交。证据目录[完整hash索引](./evidence/ui-p15-local-20261022/evidence-index.json)排除索引自身；后续提交仅保存记录，不改绑工程范围。

六份原始Playwright失败上下文含工具生成的行尾空格，首次暂存检查保存为 `precommit-whitespace-before.log`。仅对这六个精确路径增加 `.gitattributes -whitespace`，不改写原证据字节。
