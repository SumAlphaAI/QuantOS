# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: web101-current.spec.ts >> all seven pages record zero axe violations, desktop/light/mobile captures and CSS zoom reflow
- Location: tests/e2e/web101-current.spec.ts:25:5

# Error details

```
Error: / CSS zoom

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 0
Received:    45
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "跳到主要内容" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - banner [ref=e3]:
    - generic [ref=e4]:
      - link "SumAlpha 首页" [ref=e5] [cursor=pointer]:
        - /url: /
        - text: SUMALPHA
      - navigation "官网导航" [ref=e9]:
        - link "产品" [ref=e10] [cursor=pointer]:
          - /url: /product
        - link "架构与安全" [ref=e11] [cursor=pointer]:
          - /url: /architecture-security
        - link "使用场景" [ref=e12] [cursor=pointer]:
          - /url: /use-cases
        - link "文档" [ref=e13] [cursor=pointer]:
          - /url: /docs
        - link "访问申请" [ref=e14] [cursor=pointer]:
          - /url: /access-request
        - link "登录" [ref=e15] [cursor=pointer]:
          - /url: /login
      - link "申请访问" [ref=e16] [cursor=pointer]:
        - /url: /access-request
  - main [ref=e17]:
    - generic [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]: 当前开放范围：Research / Paper / Shadow
        - heading "AI-native operating system for quantitative research and trading" [level=1] [ref=e22]
        - paragraph [ref=e23]: QuantOS 把研究、策略治理、风险审批与执行留证放进同一条证据链。 Agent 始终只能提出建议——是否执行，由确定性风控与人工审批决定。
        - generic [ref=e24]:
          - link "申请访问" [ref=e25] [cursor=pointer]:
            - /url: /access-request
          - link "查看架构" [ref=e26] [cursor=pointer]:
            - /url: /architecture-security
        - img "提议、风险决策、审批到执行命令的受控链路示意图" [ref=e28]:
          - generic [ref=e35]:
            - generic [ref=e37]: TradeProposal
            - generic [ref=e38]: 不可执行建议
          - generic [ref=e39]:
            - generic [ref=e41]: RiskDecision
            - generic [ref=e42]: 服务端风控结论
          - generic [ref=e43]:
            - generic [ref=e45]: Approval
            - generic [ref=e46]: MFA · 职责分离
          - generic [ref=e47]:
            - generic [ref=e49]: TradeCommand
            - generic [ref=e50]: 幂等 · 审计留证
          - generic [ref=e51]: 每一步均为版本化对象；TradeProposal 永远标记为不可执行，TradeCommand 只能由服务端在风控与审批通过后生成。
      - generic [ref=e52]:
        - generic [ref=e53]: 01 / 信任边界
        - heading "三条不变承诺" [level=2] [ref=e54]
        - paragraph [ref=e55]: 写在系统协议里的约束，而不是营销文案。
        - generic [ref=e56]:
          - generic [ref=e57]:
            - strong [ref=e58]: Agent 不直接下单
            - paragraph [ref=e60]: Agent 产出永远是不可执行的 TradeProposal；前端不拼装交易命令、不持有交易密钥。
          - generic [ref=e61]:
            - strong [ref=e62]: 默认 Paper / Shadow
            - paragraph [ref=e64]: 所有策略先在模拟账本与影子模式下验证；更高风险模式必须由服务端 capability 显式放行。
          - generic [ref=e65]:
            - strong [ref=e66]: 全链路审计
            - paragraph [ref=e68]: 每个受控动作携带 correlation ID，从研究输入到订单成交可在五分钟内核验完整证据链。
      - generic [ref=e69]:
        - generic [ref=e70]: 02 / 能力
        - heading "四项核心能力" [level=2] [ref=e71]
        - paragraph [ref=e72]: 从研究假设到审计回放，覆盖量化团队的完整闭环。
        - generic [ref=e73]:
          - link "CAP-01 Research 固定输入、可重放的研究运行；每次执行产出带环境哈希与证据的 Artifact，取消在两秒内受理。 了解研究闭环 →" [ref=e74] [cursor=pointer]:
            - /url: /product#research
            - generic [ref=e75]: CAP-01
            - heading "Research" [level=3] [ref=e76]
            - paragraph [ref=e77]: 固定输入、可重放的研究运行；每次执行产出带环境哈希与证据的 Artifact，取消在两秒内受理。
            - generic [ref=e78]: 了解研究闭环 →
          - link "CAP-02 Strategy Governance 草稿自动版本化、静态检查与固定快照回测；未验证、未审批的策略无法生成 Release。 了解策略治理 →" [ref=e79] [cursor=pointer]:
            - /url: /product#strategy
            - generic [ref=e80]: CAP-02
            - heading "Strategy Governance" [level=3] [ref=e81]
            - paragraph [ref=e82]: 草稿自动版本化、静态检查与固定快照回测；未验证、未审批的策略无法生成 Release。
            - generic [ref=e83]: 了解策略治理 →
          - link "CAP-03 Risk & Execution 服务端风控决策与职责分离审批；命令提交幂等，重复提交只产生一笔下游订单。 了解风险与执行 →" [ref=e84] [cursor=pointer]:
            - /url: /product#risk
            - generic [ref=e85]: CAP-03
            - heading "Risk & Execution" [level=3] [ref=e86]
            - paragraph [ref=e87]: 服务端风控决策与职责分离审批；命令提交幂等，重复提交只产生一笔下游订单。
            - generic [ref=e88]: 了解风险与执行 →
          - link "CAP-04 Audit correlation/causation 链完整可查；受控导出异步生成、短时链接、逐次授权并留痕。 了解审计能力 →" [ref=e89] [cursor=pointer]:
            - /url: /product#audit
            - generic [ref=e90]: CAP-04
            - heading "Audit" [level=3] [ref=e91]
            - paragraph [ref=e92]: correlation/causation 链完整可查；受控导出异步生成、短时链接、逐次授权并留痕。
            - generic [ref=e93]: 了解审计能力 →
      - generic [ref=e94]:
        - generic [ref=e95]: 03 / 对象链
        - heading "版本化对象，而不是聊天记录" [level=2] [ref=e96]
        - paragraph [ref=e97]: DataSnapshot 到 TradeCommand 的每一步都有内容哈希、版本与责任人。
        - list [ref=e98]:
          - listitem [ref=e99]:
            - generic [ref=e100]: OBJ-1
            - generic [ref=e101]: DataSnapshot
            - generic [ref=e102]: 带质量、许可与时效标记的数据快照；过期或许可缺失即阻断下游用途。
          - listitem [ref=e103]:
            - generic [ref=e104]: OBJ-2
            - generic [ref=e105]: StrategyRelease
            - generic [ref=e106]: 不可变发布：参数、回测、数据与证据哈希齐全后才允许进入审批。
          - listitem [ref=e107]:
            - generic [ref=e108]: OBJ-3
            - generic [ref=e109]: TradeProposal
            - generic [ref=e110]: Agent 或研究员提交的建议，永久标记 executable=false，过期即不可评估。
          - listitem [ref=e111]:
            - generic [ref=e112]: OBJ-4
            - generic [ref=e113]: RiskDecision
            - generic [ref=e114]: 只能由服务端风控创建；自批、过期、额度变化均被明确拒绝。
          - listitem [ref=e115]:
            - generic [ref=e116]: OBJ-5
            - generic [ref=e117]: TradeCommand
            - generic [ref=e118]: 携带 Idempotency-Key 提交；订单与成交时间线贯通对账与审计。
      - generic [ref=e119]:
        - generic [ref=e120]: 04 / 团队
        - heading "同一条证据链上的四种角色" [level=2] [ref=e121]
        - paragraph [ref=e122]: 研究员、量化开发、交易员与风控负责人共享同一份事实，而非各自的截图。
        - list [ref=e123]:
          - listitem [ref=e124]:
            - strong [ref=e125]: 研究员
            - paragraph [ref=e126]: 发起可重放研究，引用 Artifact 证据支持策略假设。
          - listitem [ref=e127]:
            - strong [ref=e128]: 量化开发
            - paragraph [ref=e129]: 在固定快照与成本模型下回测，静态检查不过即无法发布。
          - listitem [ref=e130]:
            - strong [ref=e131]: 交易员
            - paragraph [ref=e132]: 在 Trade Ticket 中逐步刷新报价、余额与限额，只预填意图、不生成命令。
          - listitem [ref=e133]:
            - strong [ref=e134]: 风控负责人
            - paragraph [ref=e135]: 审批链上查看实时敞口与规则命中，kill switch 常驻可见。
      - generic [ref=e136]:
        - generic [ref=e137]: 05 / 开发者与治理
        - heading "开放的协议，封闭的权限" [level=2] [ref=e138]
        - paragraph [ref=e139]: Engine Protocol 允许接入自有研究引擎，但权限、数据许可与供应链治理由平台统一裁决。
        - generic [ref=e140]:
          - generic [ref=e141]:
            - generic [ref=e142]: GOV-01
            - heading "Engine Protocol" [level=3] [ref=e143]
            - paragraph [ref=e144]: gRPC 契约与 manifest 声明能力边界；引擎不接触交易链路，只产出研究 Artifact。
          - generic [ref=e145]:
            - generic [ref=e146]: GOV-02
            - heading "数据许可" [level=3] [ref=e147]
            - paragraph [ref=e148]: 每个数据源标注许可与用途范围；license 缺失的快照不能进入策略或交易流程。
          - generic [ref=e149]:
            - generic [ref=e150]: GOV-03
            - heading "第三方治理" [level=3] [ref=e151]
            - paragraph [ref=e152]: 依赖经过许可审查与 SBOM 清单管理；上游变更进入评估队列，不静默升级。
        - link "阅读架构、API 与 Runbook 文档" [ref=e154] [cursor=pointer]:
          - /url: /docs
      - generic [ref=e155]:
        - generic [ref=e156]: 06 / 访问
        - heading "为谁而建，不为谁而建" [level=2] [ref=e157]
        - paragraph [ref=e158]: QuantOS 面向有风控纪律的专业团队。当前仅开放 Research / Paper / Shadow，不面向公众投资者。
        - list [ref=e159]:
          - listitem [ref=e160]:
            - strong [ref=e161]: 适用
            - paragraph [ref=e162]: 量化研究团队、自营交易团队、需要审计证据链的机构开发与风控部门。
          - listitem [ref=e163]:
            - strong [ref=e164]: 不适用
            - paragraph [ref=e165]: 公众投资推荐、收益宣传、社区跟单与喊单场景——这些功能不存在，也不会出现。
        - generic [ref=e166]:
          - link "提交访问申请" [ref=e167] [cursor=pointer]:
            - /url: /access-request
          - link "查看使用场景" [ref=e168] [cursor=pointer]:
            - /url: /use-cases
  - contentinfo [ref=e169]:
    - generic [ref=e170]:
      - generic [ref=e171]:
        - link "SumAlpha 首页" [ref=e172] [cursor=pointer]:
          - /url: /
          - text: SUMALPHA
        - paragraph [ref=e176]: QuantOS 是面向专业量化团队的 AI 原生研究与交易操作系统。Agent 只提出建议，绝不直接下单； 所有受控操作默认在 Paper/Shadow 模式执行并留存全链路审计。
      - navigation "产品导航" [ref=e177]:
        - heading "产品" [level=2] [ref=e178]
        - list [ref=e179]:
          - listitem [ref=e180]:
            - link "产品能力" [ref=e181] [cursor=pointer]:
              - /url: /product
          - listitem [ref=e182]:
            - link "架构与安全" [ref=e183] [cursor=pointer]:
              - /url: /architecture-security
          - listitem [ref=e184]:
            - link "使用场景" [ref=e185] [cursor=pointer]:
              - /url: /use-cases
          - listitem [ref=e186]:
            - link "文档中心" [ref=e187] [cursor=pointer]:
              - /url: /docs
      - navigation "支持导航" [ref=e188]:
        - heading "支持" [level=2] [ref=e189]
        - list [ref=e190]:
          - listitem [ref=e191]:
            - link "访问申请" [ref=e192] [cursor=pointer]:
              - /url: /access-request
          - listitem [ref=e193]:
            - link "登录 Terminal" [ref=e194] [cursor=pointer]:
              - /url: /login
          - listitem [ref=e195]:
            - link "系统状态" [ref=e196] [cursor=pointer]:
              - /url: http://localhost:3190/maintenance
    - generic [ref=e197]: © 2026 SumAlpha。本网站不构成投资建议，不宣传任何收益；QuantOS 不提供公众投资推荐、社区跟单或收益排行功能。 访问申请与登录行为将被限速并记录审计。
  - alert [ref=e198]
```

# Test source

```ts
  1  | import { expect, test, type Page } from "@playwright/test";
  2  | import { AxeBuilder } from "@axe-core/playwright";
  3  | import { writeFile } from "node:fs/promises";
  4  | const id = "11111111-1111-4111-8111-111111111111", receipt = { status: "accepted", jobId: id, correlationId: id, auditRef: id };
  5  | async function fill(page: Page) {
  6  |   await page.goto("/access-request"); const f = page.locator('[data-smoke="website-access-form"]');
  7  |   await f.locator('[name="teamName"]').fill("WEB101 Team"); await f.locator('[name="contactEmail"]').fill("web101@example.invalid"); await f.locator('[name="purpose"]').fill("Controlled research and paper workflows for a professional team."); await f.locator('[name="consent"]').check(); return f;
  8  | }
  9  | test("malformed 202 stays unknown until explicit acknowledgement; no fake permission granted", async ({ page }) => {
  10 |   let count = 0; await page.route("**/v1/access-requests", r => r.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify(++count === 1 ? {} : receipt) })); const f = await fill(page); await f.getByRole("button", { name: "提交申请", exact: true }).click(); await expect(f.locator(".form-error")).toContainText("结果未知"); await expect(page.getByRole("heading", { name: "申请已受理" })).toHaveCount(0); await expect(f.getByRole("button", { name: "提交申请", exact: true })).toBeDisabled(); expect(count).toBe(1);
  11 |   await f.getByRole("button", { name: "已核查受理状态，允许重新提交" }).click(); await f.getByRole("button", { name: "提交申请", exact: true }).click(); await expect(page.getByRole("heading", { name: "申请已受理" })).toBeVisible(); expect(count).toBe(2);
  12 | });
  13 | test("same-tick duplicate submit is latched and locks fields until an audited response", async ({ page }) => {
  14 |   let count = 0; let finish!: () => void; await page.route("**/v1/access-requests", async r => { count++; await new Promise<void>(resolve => { finish = resolve; }); await r.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify(receipt) }); }); const f = await fill(page); await f.evaluate(form => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); await expect.poll(() => count).toBe(1); await expect(f.locator('[name="teamName"]')).toBeDisabled(); finish(); await expect(page.getByRole("heading", { name: "申请已受理" })).toBeVisible(); expect(count).toBe(1);
  15 | });
  16 | test("in-flight network loss retains input and never automatically replays after recovery", async ({ page, context }) => {
  17 |   let count = 0; await page.route("**/v1/access-requests", async r => { count++; await r.abort("failed"); }); const f = await fill(page); await f.getByRole("button", { name: "提交申请", exact: true }).click(); await expect(f.locator(".form-error")).toContainText("结果未知"); await context.setOffline(true); await page.evaluate(() => dispatchEvent(new Event("offline"))); await context.setOffline(false); await page.evaluate(() => dispatchEvent(new Event("online"))); await expect(f.locator('[name="teamName"]')).toHaveValue("WEB101 Team"); await expect(f.getByRole("button", { name: "提交申请", exact: true })).toBeDisabled(); expect(count).toBe(1); await expect(page.getByRole("heading", { name: "申请已受理" })).toHaveCount(0);
  18 | });
  19 | for (const status of [403, 422, 503]) test(`HTTP ${status} never displays private provider details or a false success`, async ({ page }) => {
  20 |   await page.route("**/v1/access-requests", r => r.fulfill({ status, contentType: "application/json", body: JSON.stringify({ code: "REFUSED", message: "PRIVATE-SQL-TOKEN", correlationId: id }) })); const f = await fill(page); await f.getByRole("button", { name: "提交申请", exact: true }).click(); await expect(f.locator(".form-error")).toBeVisible(); await expect(page.locator("body")).not.toContainText("PRIVATE-SQL-TOKEN"); await expect(f.locator('[name="teamName"]')).toHaveValue("WEB101 Team"); await expect(page.getByRole("heading", { name: "申请已受理" })).toHaveCount(0); if (status === 503) await expect(f.getByRole("button", { name: "提交申请", exact: true })).toBeDisabled();
  21 | });
  22 | test("missing consent and manipulated public mode cannot send a request", async ({ page }) => {
  23 |   let count = 0; await page.route("**/v1/access-requests", r => { count++; return r.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify(receipt) }); }); const f = await fill(page); await f.locator('[name="consent"]').uncheck(); await f.evaluate(form => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); await expect(f.locator(".form-error")).toContainText("隐私同意"); expect(count).toBe(0); await f.locator('[name="consent"]').check(); await f.locator('[name="expectedMode"]').evaluate(select => { select.appendChild(Object.assign(document.createElement("option"), { value: "assisted_live", selected: true })); }); await f.evaluate(form => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); expect(count).toBe(0);
  24 | });
  25 | test("all seven pages record zero axe violations, desktop/light/mobile captures and CSS zoom reflow", async ({ page }, info) => {
  26 |   const scans = []; for (const [name, path] of [["home", "/"], ["product", "/product"], ["architecture", "/architecture-security"], ["use-cases", "/use-cases"], ["docs", "/docs"], ["access", "/access-request"], ["login", "/login"]]) {
  27 |     await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ colorScheme: "dark" }); await page.goto(path!); const a = await new AxeBuilder({ page }).analyze(); scans.push({ name, path, violations: a.violations, incomplete: a.incomplete }); expect(a.violations, path).toEqual([]);
  28 |     for (const variant of ["desktop", "light", "mobile"]) { if (variant === "light") await page.emulateMedia({ colorScheme: "light" }); if (variant === "mobile") { await page.emulateMedia({ colorScheme: "dark" }); await page.setViewportSize({ width: 390, height: 844 }); } const png = info.outputPath(`${name}-${variant}.png`); await page.screenshot({ path: png, fullPage: true }); await info.attach(`${name}-${variant}`, { path: png, contentType: "image/png" }); expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${path} ${variant}`).toBeLessThanOrEqual(0); }
> 29 |     await page.evaluate(() => { document.documentElement.style.zoom = "2"; }); expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${path} CSS zoom`).toBeLessThanOrEqual(0);
     |                                                                                                                                                                                                                   ^ Error: / CSS zoom
  30 |   } const out = info.outputPath("axe.json"); await writeFile(out, JSON.stringify(scans, null, 2)); await info.attach("axe", { path: out, contentType: "application/json" });
  31 | });
  32 | test("keyboard skip link reaches main content and public pages send no application without consent", async ({ page }) => {
  33 |   const requests: string[] = []; page.on("request", r => { if (r.method() === "POST") requests.push(r.url()); }); await page.goto("/"); await page.keyboard.press("Tab"); await expect(page.getByRole("link", { name: "跳到主要内容" })).toBeFocused(); await page.keyboard.press("Enter"); await expect(page).toHaveURL(/#main-content$/); await page.goto("/login"); await expect(page.getByRole("link", { name: "前往 Terminal 登录" })).toHaveAttribute("href", "http://localhost:3190/login"); await expect(page.locator('input[type="password"]')).toHaveCount(0); expect(requests).toEqual([]);
  34 | });
  35 | 
```