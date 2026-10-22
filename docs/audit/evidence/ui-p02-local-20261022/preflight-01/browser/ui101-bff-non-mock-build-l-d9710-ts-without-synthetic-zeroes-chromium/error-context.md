# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui101-bff.spec.ts >> non-mock build loads generated session/context/summary and shows scoped facts without synthetic zeroes
- Location: tests/e2e/ui101-bff.spec.ts:15:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 93

- Array []
+ Array [
+   Object {
+     "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
+     "help": "Elements must meet minimum color contrast ratio thresholds",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.13/color-contrast?application=playwright",
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f7f9fc",
+               "contrastRatio": 2.67,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#8b9cac",
+               "fontSize": "9.8pt (13px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.67 (foreground color: #8b9cac, background color: #f7f9fc, font size: 9.8pt (13px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div data-ui101-shell=\"true\" data-ui-p02=\"true\" data-contract-mode=\"integrated\" class=\"q-terminal-frame terminal-shell p02-shell\">",
+                 "target": Array [
+                   ".q-terminal-frame",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.67 (foreground color: #8b9cac, background color: #f7f9fc, font size: 9.8pt (13px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"p02-window\">当前快照</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".p02-window",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#ffffff",
+               "contrastRatio": 2.1,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#42bff1",
+               "fontSize": "10.5pt (14px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.1 (foreground color: #42bff1, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<section class=\"panel health-panel\" aria-labelledby=\"health-heading\">",
+                 "target": Array [
+                   ".health-panel",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.1 (foreground color: #42bff1, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<a class=\"panel-link\" href=\"/operations\">打开 Operations <span aria-hidden=\"true\">›</span></a>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".panel-link[href$=\"operations\"]",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.color",
+       "wcag2aa",
+       "wcag143",
+       "TTv5",
+       "TT13.c",
+       "EN-301-549",
+       "EN-9.1.4.3",
+       "ACT",
+       "RGAAv4",
+       "RGAA-3.2.1",
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - link "跳至正文" [ref=e5] [cursor=pointer]:
      - /url: "#_r_0_"
    - banner [ref=e6]:
      - button "折叠侧栏" [expanded] [ref=e7] [cursor=pointer]:
        - emphasis [ref=e11]
        - generic [ref=e12]: SUMALPHA
      - generic "当前主工作区（只读）：33333333-3333-4333-8333-333333333333" [ref=e13] [cursor=pointer]: ▣ Workspace 33333333…
      - generic "44444444-4444-4444-8444-444444444444" [ref=e14] [cursor=pointer]: Account 44444444…
      - generic [ref=e15]: SHADOW
      - status "Stale" [ref=e18]:
        - generic [ref=e19]: ▲
      - status "Unknown / upgrade required" [ref=e23]:
        - generic [ref=e24]: ▲
      - generic [ref=e26]:
        - generic [ref=e27]: ⌕
        - textbox "全局搜索" [disabled] [ref=e28]:
          - /placeholder: 搜索  ⌘K
      - button "通知" [disabled] [ref=e29] [cursor=pointer]: ♧
      - link "帮助" [ref=e30] [cursor=pointer]:
        - /url: "#command-help"
        - text: "?"
      - link "打开个人设置" [ref=e31] [cursor=pointer]:
        - /url: /settings/profile
        - text: "11"
    - complementary "主导航" [ref=e32]:
      - navigation [ref=e33]:
        - link "Command" [ref=e34] [cursor=pointer]:
          - /url: /command
          - generic [ref=e35]: ⌂
        - link "Audit" [ref=e37] [cursor=pointer]:
          - /url: /audit
          - generic [ref=e38]: ▥
        - link "Operations" [ref=e40] [cursor=pointer]:
          - /url: /operations
          - generic [ref=e41]: ≋
    - main [ref=e43]:
      - generic [ref=e44]:
        - generic [ref=e45]:
          - generic [ref=e46]:
            - generic [ref=e47]: Home
            - generic [ref=e48]: /
            - strong [ref=e49]: Command
          - heading "Command Center" [level=1] [ref=e50]
          - paragraph [ref=e51]: 主工作区的研究、风险与运行状态。
        - generic [ref=e52]:
          - generic "C02仅读取当前受权账户" [ref=e53] [cursor=pointer]: Account 44444444…
          - generic [ref=e54]: 当前快照
          - button "刷新" [ref=e55] [cursor=pointer]: ↻
          - button "布局设置" [ref=e56] [cursor=pointer]: ⊞
      - region "当前运行模式" [ref=e57]:
        - strong [ref=e61]: SHADOW
        - generic [ref=e62]: ·
        - generic [ref=e63]: 影子运行。不会向交易所提交订单。
        - generic [ref=e65]:
          - status "Unknown / upgrade required" [ref=e66]:
            - generic [ref=e67]: ▲
          - generic [ref=e69]: C02 服务端风险事实
      - status [ref=e70]: 部分来源不可用；数据陈旧或未知；仅显示当前账户已授权的服务端快照，请刷新核验。
      - generic [ref=e71]:
        - region [ref=e72]:
          - generic [ref=e73]:
            - heading "优先处理" [level=2] [ref=e74]
            - generic "优先级筛选" [ref=e75]:
              - button "全部" [pressed] [ref=e76] [cursor=pointer]
              - button "严重 0" [ref=e77] [cursor=pointer]
              - button "警告 0" [ref=e78] [cursor=pointer]
              - button "信息 0" [ref=e79] [cursor=pointer]
          - generic [ref=e80]: 可用授权来源暂无待办，部分来源尚不可用。
          - button "查看全部待办（0）" [disabled] [ref=e82]:
            - text: 查看全部待办（0）
            - generic [ref=e83]: ›
        - region [ref=e84]:
          - generic [ref=e85]:
            - heading "系统健康" [level=2] [ref=e86]
            - generic [ref=e87]: 未知
          - generic [ref=e88]:
            - generic [ref=e89]: 来源
            - generic [ref=e90]: 状态
            - generic [ref=e91]: 延迟/性能
            - generic [ref=e92]: 可用性
            - generic [ref=e93]: 来源时间
          - generic [ref=e94]:
            - generic [ref=e95]: Operations
            - generic [ref=e96]: Unavailable
            - generic "C02未提供延迟" [ref=e98]: —
            - generic "C02未提供可用率" [ref=e99]: —
            - code [ref=e100]: 时间未知
          - link "打开 Operations" [ref=e101] [cursor=pointer]:
            - /url: /operations
            - text: 打开 Operations
            - generic [ref=e102]: ›
      - region "关键状态" [ref=e103]:
        - article [ref=e104]:
          - generic [ref=e105]: "!"
          - generic [ref=e106]:
            - heading "开放风险" [level=3] [ref=e107]
            - strong [ref=e108]: —
            - paragraph [ref=e109]: unknown
            - generic "来源未提供时间" [ref=e110]: 截至 时间未知
      - generic [ref=e111]:
        - region [ref=e112]:
          - heading "最近活动" [level=2] [ref=e114]
          - table "最近活动" [ref=e115]:
            - row [ref=e116]:
              - columnheader "时间" [ref=e117]
              - columnheader "Actor" [ref=e118]
              - columnheader "对象" [ref=e119]
              - columnheader "状态" [ref=e120]
              - columnheader "对象 ID" [ref=e121]
              - columnheader "详情" [ref=e122]
          - paragraph [ref=e123]: 当前可用授权来源暂无活动。
          - button "查看全部活动（0）" [disabled] [ref=e124]:
            - text: 查看全部活动（0）
            - generic [ref=e125]: ›
        - region [ref=e126]:
          - heading "快速开始" [level=2] [ref=e128]
          - link "打开审计 ›" [ref=e130] [cursor=pointer]:
            - /url: /audit
          - status [ref=e131]: 只读监控 · 默认布局
      - paragraph [ref=e132]: 每类最多展示 50 项；数据为服务端有界快照，空列表不代表完整历史为空。
      - group [ref=e133]:
        - generic "Command 数据与操作说明" [ref=e134] [cursor=pointer]
    - contentinfo "连接状态" [ref=e135]:
      - status [ref=e136]:
        - paragraph [ref=e137]: ● Connected
        - paragraph [ref=e138]: Read-only snapshot; refresh revalidates
      - generic [ref=e139]: HTTP 快照 · 未订阅实时流
      - generic "2026-10-22T07:06:01.034Z" [ref=e140]: Sampled 15:06:01 UTC+08
  - alert [ref=e141]
```

# Test source

```ts
  1  | import { expect, test, type Page } from "@playwright/test";
  2  | import { AxeBuilder } from "@axe-core/playwright";
  3  | import { writeFile } from "node:fs/promises";
  4  | import { context, summary } from "./fixtures/ui101";
  5  | const cors = { "access-control-allow-origin": "http://localhost:3190", "access-control-allow-credentials": "true" };
  6  | async function boundary(page: Page, mutate: (path: string) => { status?: number; data?: unknown } = () => ({})) {
  7  |   const paths: string[] = [];
  8  |   await page.route("http://localhost:4010/v1/**", async route => {
  9  |     const path = new URL(route.request().url()).pathname; paths.push(path);
  10 |     const row = mutate(path);
  11 |     await route.fulfill({ status: row.status ?? 200, headers: cors, contentType: "application/json", body: JSON.stringify(row.data ?? (path === "/v1/command/summary" ? summary() : context())) });
  12 |   });
  13 |   return paths;
  14 | }
  15 | test("non-mock build loads generated session/context/summary and shows scoped facts without synthetic zeroes", async ({ page }, info) => {
  16 |   const paths = await boundary(page); await page.goto("/command");
  17 |   await expect(page.locator('[data-contract-mode="integrated"]')).toBeVisible();
  18 |   await expect(page.locator(".q-workspace-mode")).toHaveText("SHADOW");
  19 |   await expect(page.locator(".account-context")).toHaveAttribute("title", context().accountId);
  20 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  21 |   await expect(page.locator(".freshness-status")).toContainText("Stale");
  22 |   await expect(page.locator(".risk-status")).toContainText("Unknown");
  23 |   await expect(page.getByRole("link", { name: "Command", exact: true })).toBeVisible();
  24 |   await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
  25 |   expect(paths).toEqual(["/v1/session", "/v1/context", "/v1/command/summary"]);
  26 |   const risk = page.locator(".kpi-card").filter({ has: page.getByRole("heading", { name: "开放风险" }) }); await expect(risk.locator("strong")).toHaveText("—");
  27 |   await expect(page.getByRole("button", { name: /发起研究/ })).toHaveCount(0);
  28 |   const axe = await new AxeBuilder({ page }).analyze(); const path = info.outputPath("axe.json"); await writeFile(path, JSON.stringify({ violations: axe.violations, incomplete: axe.incomplete }, null, 2)); await info.attach("axe.json", { path, contentType: "application/json" });
> 29 |   expect(axe.violations.filter(v => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
     |                                                                                        ^ Error: expect(received).toEqual(expected) // deep equality
  30 |   const capture = info.outputPath("command-bff-shadow.png"); await page.screenshot({ path: capture, fullPage: true }); await info.attach("command-bff-shadow.png", { path: capture, contentType: "image/png" });
  31 | });
  32 | for (const status of [401,403,404,503]) test(`summary ${status} clears projection and reaches safe recovery`, async ({ page }) => {
  33 |   const paths = await boundary(page, path => path === "/v1/command/summary" ? { status, data: { code: "REFUSED", message: "private-object-secret" } } : {});
  34 |   await page.goto("/command"); await expect(page).toHaveURL(new RegExp(status === 401 ? "/login$" : status === 503 ? "/maintenance$" : "/unauthorized$"));
  35 |   expect(paths).toHaveLength(3); await expect(page.locator("body")).not.toContainText("private-object-secret"); await expect(page.locator('[data-ui101-shell]')).toHaveCount(0);
  36 | });
  37 | for (const kind of ["workspace", "capability", "mode"]) test(`${kind} refusal stops before summary`, async ({ page }) => {
  38 |   const paths = await boundary(page, path => path === "/v1/context" ? { data: { ...context(), ...(kind === "workspace" ? { workspaceId: "55555555-5555-4555-8555-555555555555" } : kind === "capability" ? { capabilities: [] } : { mode: "assisted_live" }) } } : {});
  39 |   await page.goto("/command"); await expect(page).toHaveURL(/\/unauthorized$/); expect(paths).toEqual(["/v1/session", "/v1/context"]);
  40 | });
  41 | test("refresh rechecks authorization and removes an already displayed projection", async ({ page }) => {
  42 |   let revoked = false;
  43 |   const paths = await boundary(page, path => revoked && path === "/v1/context" ? { data: { ...context(), capabilities: [] } } : {});
  44 |   await page.goto("/command"); await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  45 |   revoked = true; await page.getByRole("button", { name: "刷新", exact: true }).click(); await expect(page).toHaveURL(/\/unauthorized$/);
  46 |   expect(paths.filter(p => p === "/v1/command/summary")).toHaveLength(1); await expect(page.locator('[data-ui101-shell]')).toHaveCount(0);
  47 | });
  48 | test("network recovery revalidates; it cannot promote stale data to fresh", async ({ page, context: browser }) => {
  49 |   const paths = await boundary(page); await page.goto("/command"); await expect(page.locator(".freshness-status")).toContainText("Stale");
  50 |   await browser.setOffline(true); await page.evaluate(() => dispatchEvent(new Event("offline"))); await expect(page.getByRole("alert").filter({ hasText: "网络已断开" })).toBeVisible();
  51 |   await browser.setOffline(false); await page.evaluate(() => dispatchEvent(new Event("online")));
  52 |   await expect.poll(() => paths.filter(p => p === "/v1/command/summary").length).toBeGreaterThanOrEqual(2);
  53 |   await expect(page.locator(".freshness-status")).toContainText("Stale"); await expect(page.locator(".p02-data-notice")).toContainText("陈旧");
  54 | });
  55 | test("expired summary refuses with no fallback data", async ({ page }) => {
  56 |   await boundary(page, path => path === "/v1/command/summary" ? { data: { ...summary(), expiresAt: "2000-01-01T00:00:00Z" } } : {});
  57 |   await page.goto("/command"); await expect(page).toHaveURL(/\/offline$/); await expect(page.locator('[data-ui101-shell]')).toHaveCount(0);
  58 | });
  59 | test("session deadline removes the mounted shell and rechecks before loading data", async ({ page }) => {
  60 |   let expired = false;
  61 |   await boundary(page, path => path !== "/v1/command/summary" ? { data: { ...context(), expiresAt: expired ? "2000-01-01T00:00:00Z" : new Date(Date.now() + 2000).toISOString() } } : {});
  62 |   await page.goto("/command"); await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible(); expired = true;
  63 |   await expect(page).toHaveURL(/\/login$/, { timeout: 7000 }); await expect(page.locator('[data-ui101-shell]')).toHaveCount(0);
  64 | });
  65 | 
  66 | test("authoritative context fits 390px and CSS zoom=2 while staying read-only", async ({ page }) => {
  67 |   await boundary(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/command");
  68 |   await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  69 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  70 |   await expect(page.locator(".high-risk-action").first()).toBeHidden();
  71 |   await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  72 |   expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  73 | });
  74 | 
  75 | test("verified normal risk uses the healthy presentation, while null metrics remain unknown", async ({ page }) => {
  76 |   await boundary(page, path => path === "/v1/context" ? { data: { ...context(), capabilities: [...context().capabilities, "execution.operate"] } } : path === "/v1/command/summary" ? { data: { ...summary(), partial: false, riskPosture: "normal", sources: summary().sources.map(source => ({ ...source, status: "ready", asOf: new Date().toISOString(), sourceHash: "sha256:" + "a".repeat(64) })) } } : {});
  77 |   await page.goto("/command");
  78 |   const risk = page.locator(".kpi-card").filter({ has: page.getByRole("heading", { name: "开放风险" }) });
  79 |   await expect(risk.locator("p")).toHaveText("normal"); await expect(risk.locator("p")).toHaveClass("good"); await expect(risk.locator("strong")).toHaveText("—");
  80 | });
  81 | 
```