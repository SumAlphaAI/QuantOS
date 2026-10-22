# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p02.spec.ts >> P02 light responsive layouts, keyboard and axe
- Location: tests/e2e/ui-p02.spec.ts:77:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: frame.evaluate: Test timeout of 30000ms exceeded.
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
      - generic [ref=e15]: PAPER
      - status "Live" [ref=e18]:
        - generic [ref=e19]: ●
      - status "Approval required" [ref=e23]:
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
        - link "Research" [ref=e37] [cursor=pointer]:
          - /url: /research
          - generic [ref=e38]: ◉
        - link "Strategy" [ref=e40] [cursor=pointer]:
          - /url: /strategies
          - generic [ref=e41]: ↗
        - link "Trade" [ref=e43] [cursor=pointer]:
          - /url: /trade
          - generic [ref=e44]: ⇄
        - link "Proposals" [ref=e46] [cursor=pointer]:
          - /url: /proposals
          - generic [ref=e47]: ▤
        - link "Approvals" [ref=e49] [cursor=pointer]:
          - /url: /approvals
          - generic [ref=e50]: ✓
          - generic "2 条待处理" [ref=e52]: "2"
        - link "Orders" [ref=e53] [cursor=pointer]:
          - /url: /orders
          - generic [ref=e54]: ▣
        - link "Audit" [ref=e56] [cursor=pointer]:
          - /url: /audit
          - generic [ref=e57]: ▥
        - link "Operations" [ref=e59] [cursor=pointer]:
          - /url: /operations
          - generic [ref=e60]: ≋
    - main [ref=e62]:
      - generic [ref=e63]:
        - generic [ref=e64]:
          - generic [ref=e65]:
            - generic [ref=e66]: Home
            - generic [ref=e67]: /
            - strong [ref=e68]: Command
          - heading "Command Center" [level=1] [ref=e69]
          - paragraph [ref=e70]: 主工作区的研究、风险与运行状态。
        - generic [ref=e71]:
          - generic "C02仅读取当前受权账户" [ref=e72] [cursor=pointer]: Account 44444444…
          - generic [ref=e73]: 当前快照
          - button "刷新" [ref=e74] [cursor=pointer]: ↻
          - button "布局设置" [ref=e75] [cursor=pointer]: ⊞
      - region "当前运行模式" [ref=e76]:
        - strong [ref=e80]: PAPER
        - generic [ref=e81]: ·
        - generic [ref=e82]: 模拟账本。不会向交易所提交订单。
        - generic [ref=e84]:
          - status "Approval required" [ref=e85]:
            - generic [ref=e86]: ▲
          - generic [ref=e88]: C02 服务端风险事实
      - generic [ref=e89]:
        - region [ref=e90]:
          - generic [ref=e91]:
            - heading "优先处理" [level=2] [ref=e92]
            - generic "优先级筛选" [ref=e93]:
              - button "全部" [pressed] [ref=e94] [cursor=pointer]
              - button "严重 2" [ref=e95] [cursor=pointer]
              - button "警告 1" [ref=e96] [cursor=pointer]
              - button "信息 1" [ref=e97] [cursor=pointer]
          - generic [ref=e98]:
            - generic [ref=e99]:
              - generic [ref=e100]: △
              - strong [ref=e101]: 审批待办
              - generic "/approvals/10000000-0000-4000-8000-000000000001" [ref=e102]: pending · 10000000…
              - code [ref=e103]: 时间未知
              - link "查看审批待办 10000000-0000-4000-8000-000000000001" [ref=e104] [cursor=pointer]:
                - /url: /approvals/10000000-0000-4000-8000-000000000001
                - text: 查看 ›
            - generic [ref=e105]:
              - generic [ref=e106]: "!"
              - strong [ref=e107]: 风险告警
              - generic "/operations/alerts/10000000-0000-4000-8000-000000000002" [ref=e108]: open · 10000000…
              - code [ref=e109]: 10:41:48
              - link "查看风险告警 10000000-0000-4000-8000-000000000002" [ref=e110] [cursor=pointer]:
                - /url: /operations/alerts/10000000-0000-4000-8000-000000000002
                - text: 查看 ›
            - generic [ref=e111]:
              - generic [ref=e112]: "!"
              - strong [ref=e113]: 研究任务
              - generic "/research/runs/10000000-0000-4000-8000-000000000003" [ref=e114]: failed · 10000000…
              - code [ref=e115]: 10:41:38
              - link "查看研究任务 10000000-0000-4000-8000-000000000003" [ref=e116] [cursor=pointer]:
                - /url: /research/runs/10000000-0000-4000-8000-000000000003
                - text: 查看 ›
          - button "查看全部待办（4）" [ref=e117] [cursor=pointer]:
            - text: 查看全部待办（4）
            - generic [ref=e118]: ›
        - region [ref=e119]:
          - generic [ref=e120]:
            - heading "系统健康" [level=2] [ref=e121]
            - generic [ref=e122]: degraded
          - generic [ref=e123]:
            - generic [ref=e124]: 来源
            - generic [ref=e125]: 状态
            - generic [ref=e126]: 延迟/性能
            - generic [ref=e127]: 可用性
            - generic [ref=e128]: 来源时间
          - generic [ref=e129]:
            - generic [ref=e130]: Research
            - generic [ref=e131]: Ready
            - generic "C02未提供延迟" [ref=e133]: —
            - generic "C02未提供可用率" [ref=e134]: —
            - code [ref=e135]: 10:42:03
          - generic [ref=e136]:
            - generic [ref=e137]: Execution
            - generic [ref=e138]: Ready
            - generic "C02未提供延迟" [ref=e140]: —
            - generic "C02未提供可用率" [ref=e141]: —
            - code [ref=e142]: 10:42:04
          - generic [ref=e143]:
            - generic [ref=e144]: Operations
            - generic [ref=e145]: Ready
            - generic "C02未提供延迟" [ref=e147]: —
            - generic "C02未提供可用率" [ref=e148]: —
            - code [ref=e149]: 10:42:05
          - generic [ref=e150]:
            - generic [ref=e151]: Strategy
            - generic [ref=e152]: Ready
            - generic "C02未提供延迟" [ref=e154]: —
            - generic "C02未提供可用率" [ref=e155]: —
            - code [ref=e156]: 10:42:06
          - link "打开 Operations" [ref=e157] [cursor=pointer]:
            - /url: /operations
            - text: 打开 Operations
            - generic [ref=e158]: ›
      - region "关键状态" [ref=e159]:
        - article [ref=e160]:
          - generic [ref=e161]: ▤
          - generic [ref=e162]:
            - heading "数据新鲜度" [level=3] [ref=e163]
            - strong [ref=e164]: 5.0s
            - paragraph [ref=e165]: fresh
            - paragraph [ref=e166]: 采样时数据年龄
            - generic "2026-10-22T02:42:03.000Z" [ref=e167]: 截至 10:42:03
        - article [ref=e168]:
          - generic [ref=e169]: "!"
          - generic [ref=e170]:
            - heading "开放风险" [level=3] [ref=e171]
            - strong [ref=e172]: "7"
            - paragraph [ref=e173]: elevated
            - generic "2026-10-22T02:42:05.000Z" [ref=e174]: 截至 10:42:05
        - article [ref=e175]:
          - generic [ref=e176]: ▤
          - generic [ref=e177]:
            - heading "订单状态" [level=3] [ref=e178]
            - strong [ref=e179]: "18"
            - paragraph [ref=e180]: 13 Filled · 1 Rejected
            - paragraph [ref=e181]: 已提交订单 · PAPER
            - generic "2026-10-22T02:42:04.000Z" [ref=e182]: 截至 10:42:04
        - article [ref=e183]:
          - generic [ref=e184]: ⌁
          - generic [ref=e185]:
            - heading "运行任务" [level=3] [ref=e186]
            - strong [ref=e187]: "4"
            - paragraph [ref=e188]: 1 Failed
            - generic "2026-10-22T02:42:03.000Z" [ref=e189]: 截至 10:42:03
      - generic [ref=e190]:
        - region [ref=e191]:
          - heading "最近活动" [level=2] [ref=e193]
          - table "最近活动" [ref=e194]:
            - row [ref=e195]:
              - columnheader "时间" [ref=e196]
              - columnheader "Actor" [ref=e197]
              - columnheader "对象" [ref=e198]
              - columnheader "状态" [ref=e199]
              - columnheader "对象 ID" [ref=e200]
              - columnheader "详情" [ref=e201]
            - row [ref=e202]:
              - cell "10:40:28" [ref=e203]
              - cell "—" [ref=e204]
              - cell "研究任务" [ref=e205]
              - cell "failed" [ref=e206]
              - cell "10000000…" [ref=e208]
              - cell [ref=e209]:
                - link "查看研究任务 10000000-0000-4000-8000-000000000010" [ref=e210] [cursor=pointer]:
                  - /url: /research/runs/10000000-0000-4000-8000-000000000010
                  - text: 查看 ›
            - row [ref=e211]:
              - cell "10:40:18" [ref=e212]
              - cell "—" [ref=e213]
              - cell "订单" [ref=e214]
              - cell "filled" [ref=e215]
              - cell "10000000…" [ref=e217]
              - cell [ref=e218]:
                - link "查看订单 10000000-0000-4000-8000-000000000011" [ref=e219] [cursor=pointer]:
                  - /url: /orders/10000000-0000-4000-8000-000000000011
                  - text: 查看 ›
            - row [ref=e220]:
              - cell "时间未知" [ref=e221]
              - cell "—" [ref=e222]
              - cell "审批待办" [ref=e223]
              - cell "pending" [ref=e224]
              - cell "10000000…" [ref=e226]
              - cell [ref=e227]:
                - link "查看审批待办 10000000-0000-4000-8000-000000000012" [ref=e228] [cursor=pointer]:
                  - /url: /approvals/10000000-0000-4000-8000-000000000012
                  - text: 查看 ›
            - row [ref=e229]:
              - cell "10:39:58" [ref=e230]
              - cell "—" [ref=e231]
              - cell "风险告警" [ref=e232]
              - cell "open" [ref=e233]
              - cell "10000000…" [ref=e235]
              - cell [ref=e236]:
                - link "查看风险告警 10000000-0000-4000-8000-000000000013" [ref=e237] [cursor=pointer]:
                  - /url: /operations/alerts/10000000-0000-4000-8000-000000000013
                  - text: 查看 ›
            - row [ref=e238]:
              - cell "10:39:48" [ref=e239]
              - cell "—" [ref=e240]
              - cell "研究任务" [ref=e241]
              - cell "failed" [ref=e242]
              - cell "10000000…" [ref=e244]
              - cell [ref=e245]:
                - link "查看研究任务 10000000-0000-4000-8000-000000000014" [ref=e246] [cursor=pointer]:
                  - /url: /research/runs/10000000-0000-4000-8000-000000000014
                  - text: 查看 ›
          - button "查看全部活动（7）" [ref=e247] [cursor=pointer]:
            - text: 查看全部活动（7）
            - generic [ref=e248]: ›
        - region [ref=e249]:
          - heading "快速开始" [level=2] [ref=e251]
          - button "发起研究 进入研究模块后重新验证创建权限" [disabled] [ref=e252]:
            - generic [ref=e253]: ♙
            - strong [ref=e254]:
              - text: 发起研究
              - generic [ref=e255]: 进入研究模块后重新验证创建权限
            - generic [ref=e256]: ›
          - button "创建策略草稿 进入策略模块后重新验证写权限" [disabled] [ref=e257]:
            - generic [ref=e258]: ▧
            - strong [ref=e259]:
              - text: 创建策略草稿
              - generic [ref=e260]: 进入策略模块后重新验证写权限
            - generic [ref=e261]: ›
          - generic [ref=e262]:
            - link "查看研究 ›" [ref=e263] [cursor=pointer]:
              - /url: /research
            - link "打开审计 ›" [ref=e264] [cursor=pointer]:
              - /url: /audit
          - status [ref=e265]: 只读监控 · 默认布局
      - paragraph [ref=e266]: 每类最多展示 50 项；数据为服务端有界快照，空列表不代表完整历史为空。
      - group [ref=e267]:
        - generic "Command 数据与操作说明" [ref=e268] [cursor=pointer]
    - contentinfo "连接状态" [ref=e269]:
      - status [ref=e270]:
        - paragraph [ref=e271]: ● Connected
        - paragraph [ref=e272]: Read-only snapshot; refresh revalidates
      - generic [ref=e273]: HTTP 快照 · 未订阅实时流
      - generic "2026-10-22T02:42:08.000Z" [ref=e274]: Sampled 10:42:08 UTC+08
  - alert [ref=e275]
```

# Test source

```ts
  1  | import { expect, test, type Page } from "@playwright/test";
  2  | import { AxeBuilder } from "@axe-core/playwright";
  3  | import { writeFile } from "node:fs/promises";
  4  | import { P02_NOW, p02Context, p02Summary, p02Time } from "./fixtures/ui-p02";
  5  | const cors = { "access-control-allow-origin": "http://localhost:3190", "access-control-allow-credentials": "true" };
  6  | async function boundary(page: Page, mutate: (path: string, count: number) => { status?: number; data?: unknown } = () => ({})) {
  7  |   const calls: string[] = []; await page.clock.install({ time: new Date(P02_NOW) }); await page.clock.pauseAt(new Date(Date.parse(P02_NOW) + 1000));
  8  |   await page.route("http://localhost:4010/v1/**", async route => {
  9  |     expect(route.request().method()).toBe("GET"); const path = new URL(route.request().url()).pathname; calls.push(path);
  10 |     const row = mutate(path, calls.filter(p => p === path).length);
  11 |     await route.fulfill({ status: row.status ?? 200, headers: cors, contentType: "application/json", body: JSON.stringify(row.data ?? (path === "/v1/command/summary" ? p02Summary() : p02Context())) });
  12 |   });
  13 |   return calls;
  14 | }
  15 | async function loaded(page: Page) { await page.goto("/command"); await expect(page.locator('[data-ui-p02][data-contract-mode="integrated"]')).toBeVisible(); }
  16 | const metric = (page: Page, name: string) => page.locator(".kpi-card").filter({ has: page.getByRole("heading", { name, exact: true }) });
  17 | 
  18 | test("P02 guarded real-mode transport renders server counts and truthful source metadata", async ({ page }) => {
  19 |   const calls = await boundary(page); await loaded(page);
  20 |   expect(calls).toEqual(["/v1/session", "/v1/context", "/v1/command/summary"]);
  21 |   await expect(metric(page, "开放风险").locator("strong")).toHaveText("7"); await expect(metric(page, "运行任务").locator("strong")).toHaveText("4"); await expect(metric(page, "订单状态")).toContainText("13 Filled · 1 Rejected");
  22 |   await expect(metric(page, "数据新鲜度")).toContainText("5.0s"); await expect(page.locator(".p02-health-state")).toHaveText("degraded");
  23 |   await expect(page.locator(".health-row")).toHaveCount(4); expect(await page.locator(".health-row code").allTextContents()).toEqual(["10:42:03", "10:42:04", "10:42:05", "10:42:06"]);
  24 |   await expect(page.getByRole("button", { name: "通知", exact: true })).toBeDisabled(); await expect(page.getByLabel("全局搜索")).toBeDisabled(); await expect(page.locator(".terminal-statusbar")).toContainText("未订阅实时流");
  25 |   await expect(page.locator(".activity-head")).toContainText("对象 ID"); await expect(page.locator(".activity-table")).not.toContainText("Jane Smith");
  26 | });
  27 | test("capabilities crop cards and private list rows instead of showing leaked values", async ({ page }) => {
  28 |   await boundary(page, path => path !== "/v1/command/summary" ? { data: { ...p02Context(), capabilities: ["ops.read"] } } : {}); await loaded(page);
  29 |   await expect(page.locator(".kpi-card")).toHaveCount(1); await expect(metric(page, "开放风险")).toContainText("unknown");
  30 |   await expect(page.locator(".priority-row")).toHaveCount(1); await expect(page.getByRole("heading", { name: "运行任务" })).toHaveCount(0); await expect(page.getByRole("link", { name: "Research", exact: true })).toHaveCount(0);
  31 |   await expect(page.locator('a[href^="/research/runs/"]')).toHaveCount(0); await expect(page.locator('a[href^="/orders/"]')).toHaveCount(0); await expect(page.locator(".nav-badge")).toHaveCount(0);
  32 | });
  33 | test("forbidden research data stays concealed even if rows arrive in a partial response", async ({ page }) => {
  34 |   await boundary(page, path => { if (path !== "/v1/command/summary") return {}; const s = p02Summary(); s.partial = true; s.sources[0].status = "forbidden"; s.sources[0].asOf = null; s.sources[0].sourceHash = null; s.runningRuns = s.failedRuns = null; return { data: s }; }); await loaded(page);
  35 |   await expect(page.getByRole("heading", { name: "运行任务" })).toHaveCount(0); await expect(page.locator('a[href^="/research/runs/"]')).toHaveCount(0); await expect(page.locator(".health-row")).toHaveCount(3); await expect(page.locator(".p02-data-notice")).toContainText("部分来源");
  36 | });
  37 | test("zero, unknown and stale metrics remain distinct with no synthetic order or run fallback", async ({ page }) => {
  38 |   await boundary(page, path => { if (path !== "/v1/command/summary") return {}; const s = p02Summary(); s.partial = true; s.dataFreshness = "stale"; s.riskPosture = "unknown"; s.sources[1].status = "stale"; s.orderSummary = null; s.pendingApprovals = null; s.runningRuns = s.failedRuns = 0; s.openRiskAlerts = 0; return { data: s }; }); await loaded(page);
  39 |   await expect(metric(page, "开放风险").locator("strong")).toHaveText("0"); await expect(metric(page, "运行任务").locator("strong")).toHaveText("0"); await expect(metric(page, "订单状态").locator("strong")).toHaveText("—"); await expect(page.locator(".freshness-status")).toContainText("Stale");
  40 | });
  41 | test("local severity filters and bounded expansions work by keyboard with exact safe resource destinations", async ({ page }) => {
  42 |   await boundary(page); await loaded(page); await expect(page.locator(".priority-row")).toHaveCount(3);
  43 |   await page.getByRole("button", { name: "查看全部待办（4）" }).click(); await expect(page.locator(".priority-row")).toHaveCount(4);
  44 |   const info = page.getByRole("button", { name: "信息 1", exact: true }); await info.focus(); await page.keyboard.press("Enter"); await expect(info).toHaveAttribute("aria-pressed", "true"); await expect(page.locator(".priority-row")).toHaveCount(1);
  45 |   await expect(page.locator(".priority-row a")).toHaveAttribute("href", p02Summary().priority[3].objectRef);
  46 |   await expect(page.locator(".activity-row[role=row]")).toHaveCount(6); await page.getByRole("button", { name: "查看全部活动（7）" }).click(); await expect(page.locator(".activity-row[role=row]")).toHaveCount(8);
  47 | });
  48 | test("empty truncated snapshots disclose incompleteness and disable empty expansion controls", async ({ page }) => {
  49 |   await boundary(page, path => path === "/v1/command/summary" ? { data: { ...p02Summary(), priority: [], recentActivity: [], bounded: { ...p02Summary().bounded, truncated: true } } } : {}); await loaded(page);
  50 |   await expect(page.locator(".p02-data-notice")).toContainText("结果已截断"); await expect(page.getByRole("button", { name: "查看全部待办（0）" })).toBeDisabled(); await expect(page.locator(".p02-empty-activity")).toBeVisible(); await expect(page.locator(".p02-bounds")).toContainText("不代表完整历史为空");
  51 | });
  52 | test("refresh drops the old snapshot, rechecks scope and recovers without any write", async ({ page }) => {
  53 |   const calls = await boundary(page, (path, count) => path === "/v1/command/summary" && count > 1 ? { data: { ...p02Summary(), runningRuns: 9 } } : {}); await loaded(page);
  54 |   await page.getByRole("button", { name: "刷新", exact: true }).click(); await expect(metric(page, "运行任务").locator("strong")).toHaveText("9"); expect(calls).toEqual(["/v1/session", "/v1/context", "/v1/command/summary", "/v1/session", "/v1/context", "/v1/command/summary"]);
  55 | });
  56 | test("offline freezes resource links, reconnect refuses revoked capability and never replays old intent", async ({ page, context }) => {
  57 |   let revoked = false; const calls = await boundary(page, path => revoked && path === "/v1/context" ? { data: { ...p02Context(), capabilities: [] } } : {}); await loaded(page);
  58 |   await context.setOffline(true); await page.evaluate(() => dispatchEvent(new Event("offline"))); await expect(page.locator("main [role=alert]")).toContainText("只读缓存"); await expect(page.getByRole("button", { name: "刷新", exact: true })).toBeDisabled(); await expect(page.locator(".priority-row a")).toHaveCount(0);
  59 |   revoked = true; await context.setOffline(false); await page.evaluate(() => dispatchEvent(new Event("online"))); await expect(page).toHaveURL(/\/unauthorized$/); expect(calls.filter(p => p === "/v1/command/summary")).toHaveLength(1);
  60 | });
  61 | for (const kind of ["resource", "order-mode", "future-source", "partial", "expired"]) test(`malformed ${kind} summary refuses without fixture fallback`, async ({ page }) => {
  62 |   await boundary(page, path => { if (path !== "/v1/command/summary") return {}; const s = p02Summary(); if (kind === "resource") s.priority[0].objectRef = "/orders/" + s.priority[0].id; if (kind === "order-mode") s.orderSummary!.mode = "shadow"; if (kind === "future-source") s.sources[0].asOf = p02Time(10_000); if (kind === "partial") s.partial = true; if (kind === "expired") s.expiresAt = p02Time(-1); return { data: s }; });
  63 |   await page.goto("/command"); await expect(page).toHaveURL(/\/offline$/); await expect(page.locator("[data-ui-p02]")).toHaveCount(0);
  64 | });
  65 | test("earlier session deadline removes the shell even when context and snapshot remain valid", async ({ page }) => {
  66 |   const calls = await boundary(page, path => path === "/v1/session" ? { data: { ...p02Context(), expiresAt: p02Time(2000) } } : {}); await loaded(page); await page.clock.fastForward(2100); await expect(page).toHaveURL(/\/login$/); expect(calls.filter(p => p === "/v1/command/summary")).toHaveLength(1);
  67 | });
  68 | test("layout preferences persist booleans only and do not alter server authority", async ({ page }) => {
  69 |   const calls = await boundary(page); await loaded(page); await page.getByRole("button", { name: "布局设置" }).click(); await page.getByRole("checkbox", { name: "紧凑布局" }).check(); await page.getByRole("button", { name: "折叠侧栏" }).click();
  70 |   expect(await page.evaluate(() => JSON.parse(localStorage.getItem("quantos.command.layout.v1")!))).toEqual({ collapsed: true, compact: true }); await page.reload(); await expect(page.locator("[data-ui-p02]")).toHaveClass(/command-compact/); await expect(page.getByRole("button", { name: "展开侧栏" })).toBeVisible(); expect(calls.filter(p => p === "/v1/command/summary")).toHaveLength(2);
  71 | });
  72 | test("storage refusal preserves interactive layout and help remains reachable", async ({ page }) => {
  73 |   await page.addInitScript(() => { Storage.prototype.setItem = () => { throw Error("denied"); }; }); await boundary(page); await loaded(page);
  74 |   await page.getByRole("button", { name: "布局设置" }).click(); await page.getByRole("checkbox", { name: "紧凑布局" }).check(); await expect(page.locator("#command-layout [role=status]")).toContainText("无法保存布局"); await page.getByRole("link", { name: "帮助", exact: true }).click(); await page.locator("#command-help summary").click(); await expect(page.locator("#command-help p")).toBeVisible();
  75 | });
  76 | for (const theme of ["dark", "light"] as const) {
  77 |   test(`P02 ${theme} responsive layouts, keyboard and axe`, async ({ page }, info) => {
  78 |     await page.emulateMedia({ colorScheme: theme }); await boundary(page); await loaded(page); const scans = [];
  79 |     for (const width of [1440, 1024, 390]) {
  80 |       await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
> 81 |       const result = await new AxeBuilder({ page }).analyze(); scans.push({ width, theme, violations: result.violations, incomplete: result.incomplete }); expect(result.violations).toEqual([]);
     |                      ^ Error: frame.evaluate: Test timeout of 30000ms exceeded.
  82 |       if (width === 390) { await expect(page.locator(".high-risk-action").first()).toBeHidden(); await page.evaluate(() => { document.documentElement.style.zoom = "2"; }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); }
  83 |       const path = info.outputPath(`command-${theme}-${width}.png`); await page.screenshot({ path, fullPage: true }); await info.attach(`command-${width}`, { path, contentType: "image/png" });
  84 |       await page.evaluate(() => { document.documentElement.style.zoom = "1"; });
  85 |     }
  86 |     const file = info.outputPath(`axe-${theme}.json`); await writeFile(file, JSON.stringify(scans, null, 2)); await info.attach("axe", { path: file, contentType: "application/json" });
  87 |   });
  88 |   test(`P02 visual baseline ${theme}`, async ({ page }) => { await page.emulateMedia({ colorScheme: theme }); await boundary(page); await loaded(page); await expect(page).toHaveScreenshot(`p02-command-${theme}.png`, { maxDiffPixelRatio: 0.005 }); });
  89 | }
  90 | 
```