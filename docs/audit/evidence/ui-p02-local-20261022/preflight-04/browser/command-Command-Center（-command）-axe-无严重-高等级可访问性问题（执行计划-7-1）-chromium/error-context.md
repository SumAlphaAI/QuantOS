# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: command.spec.ts >> Command Center（/command） >> axe 无严重/高等级可访问性问题（执行计划 7.1）
- Location: tests/e2e/command.spec.ts:40:7

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 64

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
+               "bgColor": "#dad5cc",
+               "contrastRatio": 1.13,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#eec36b",
+               "fontSize": "7.5pt (10px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.13 (foreground color: #eec36b, background color: #dad5cc, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<div class=\"command-contract-banner\" role=\"status\">C02 Runtime Guard Mocked · 本地演示数据；不代表真实会话或当前业务状态。</div>",
+                 "target": Array [
+                   ".command-contract-banner",
+                 ],
+               },
+               Object {
+                 "html": "<div data-ui101-shell=\"true\" data-ui-p02=\"true\" data-contract-mode=\"mocked\" class=\"q-terminal-frame terminal-shell p02-shell\">",
+                 "target": Array [
+                   ".q-terminal-frame",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.13 (foreground color: #eec36b, background color: #dad5cc, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<div class=\"command-contract-banner\" role=\"status\">C02 Runtime Guard Mocked · 本地演示数据；不代表真实会话或当前业务状态。</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".command-contract-banner",
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
      - generic "当前主工作区（只读）：33333333-3333-4333-8333-333333333333" [ref=e13] [cursor=pointer]: ▣ Primary workspace
      - generic "44444444-4444-4444-8444-444444444444" [ref=e14] [cursor=pointer]: Paper Account 01
      - generic [ref=e15]: PAPER
      - status "Live" [ref=e18]:
        - generic [ref=e19]: ●
      - status "Allowed" [ref=e23]:
        - generic [ref=e24]: ●
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
        - text: AN
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
        - link "Portfolio" [ref=e43] [cursor=pointer]:
          - /url: /portfolio
          - generic [ref=e44]: ◔
        - link "Markets" [ref=e46] [cursor=pointer]:
          - /url: /markets
          - generic [ref=e47]: ▥
        - link "Trade" [ref=e49] [cursor=pointer]:
          - /url: /trade
          - generic [ref=e50]: ⇄
        - link "Performance" [ref=e52] [cursor=pointer]:
          - /url: /performance
          - generic [ref=e53]: ▥
        - link "Proposals" [ref=e55] [cursor=pointer]:
          - /url: /proposals
          - generic [ref=e56]: ▤
        - link "Approvals" [ref=e58] [cursor=pointer]:
          - /url: /approvals
          - generic [ref=e59]: ✓
          - generic "3 条待处理" [ref=e61]: "3"
        - link "Orders" [ref=e62] [cursor=pointer]:
          - /url: /orders
          - generic [ref=e63]: ▣
        - link "Audit" [ref=e65] [cursor=pointer]:
          - /url: /audit
          - generic [ref=e66]: ▥
        - link "Operations" [ref=e68] [cursor=pointer]:
          - /url: /operations
          - generic [ref=e69]: ≋
        - link "Admin" [ref=e71] [cursor=pointer]:
          - /url: /admin/members
          - generic [ref=e72]: ⚙
    - main [ref=e74]:
      - status [ref=e75]: C02 Runtime Guard Mocked · 本地演示数据；不代表真实会话或当前业务状态。
      - generic [ref=e76]:
        - generic [ref=e77]:
          - generic [ref=e78]:
            - generic [ref=e79]: Home
            - generic [ref=e80]: /
            - strong [ref=e81]: Command
          - heading "Command Center" [level=1] [ref=e82]
          - paragraph [ref=e83]: 主工作区的研究、风险与运行状态。
        - generic [ref=e84]:
          - generic "C02仅读取当前受权账户" [ref=e85] [cursor=pointer]: Paper Account 01
          - generic [ref=e86]: 当前快照
          - button "刷新" [ref=e87] [cursor=pointer]: ↻
          - button "布局设置" [ref=e88] [cursor=pointer]: ⊞
      - region "当前运行模式" [ref=e89]:
        - strong [ref=e93]: PAPER
        - generic [ref=e94]: ·
        - generic [ref=e95]: 模拟账本。不会向交易所提交订单。
        - generic [ref=e97]:
          - status "Allowed" [ref=e98]:
            - generic [ref=e99]: ●
          - generic [ref=e101]: 主工作区风险规则正常
      - generic [ref=e102]:
        - region [ref=e103]:
          - generic [ref=e104]:
            - heading "优先处理" [level=2] [ref=e105]
            - generic "优先级筛选" [ref=e106]:
              - button "全部" [pressed] [ref=e107] [cursor=pointer]
              - button "严重 2" [ref=e108] [cursor=pointer]
              - button "警告 1" [ref=e109] [cursor=pointer]
              - button "信息 0" [ref=e110] [cursor=pointer]
          - generic [ref=e111]:
            - generic [ref=e112]:
              - generic [ref=e113]: △
              - strong [ref=e114]: 审批待办
              - generic "/approvals/55555555-5555-4555-8555-555555555555" [ref=e115]: pending · 55555555…
              - code [ref=e116]: 时间未知
              - link "查看审批待办 55555555-5555-4555-8555-555555555555" [ref=e117] [cursor=pointer]:
                - /url: /approvals/55555555-5555-4555-8555-555555555555
                - text: 查看 ›
            - generic [ref=e118]:
              - generic [ref=e119]: "!"
              - strong [ref=e120]: 风险告警
              - generic "/operations/alerts/66666666-6666-4666-8666-666666666666" [ref=e121]: open · 66666666…
              - code [ref=e122]: 10:40:08
              - link "查看风险告警 66666666-6666-4666-8666-666666666666" [ref=e123] [cursor=pointer]:
                - /url: /operations/alerts/66666666-6666-4666-8666-666666666666
                - text: 查看 ›
            - generic [ref=e124]:
              - generic [ref=e125]: "!"
              - strong [ref=e126]: 研究任务
              - generic "/research/runs/77777777-7777-4777-8777-777777777777" [ref=e127]: failed · 77777777…
              - code [ref=e128]: 10:36:08
              - link "查看研究任务 77777777-7777-4777-8777-777777777777" [ref=e129] [cursor=pointer]:
                - /url: /research/runs/77777777-7777-4777-8777-777777777777
                - text: 查看 ›
          - button "查看全部待办（3）" [ref=e130] [cursor=pointer]:
            - text: 查看全部待办（3）
            - generic [ref=e131]: ›
        - region [ref=e132]:
          - generic [ref=e133]:
            - heading "系统健康" [level=2] [ref=e134]
            - generic [ref=e135]: healthy
          - generic [ref=e136]:
            - generic [ref=e137]: 来源
            - generic [ref=e138]: 状态
            - generic [ref=e139]: 延迟/性能
            - generic [ref=e140]: 可用性
            - generic [ref=e141]: 来源时间
          - generic [ref=e142]:
            - generic [ref=e143]: Research
            - generic [ref=e144]: Ready
            - generic "C02未提供延迟" [ref=e146]: —
            - generic "C02未提供可用率" [ref=e147]: —
            - code [ref=e148]: 10:42:06
          - generic [ref=e149]:
            - generic [ref=e150]: Execution
            - generic [ref=e151]: Ready
            - generic "C02未提供延迟" [ref=e153]: —
            - generic "C02未提供可用率" [ref=e154]: —
            - code [ref=e155]: 10:42:06
          - generic [ref=e156]:
            - generic [ref=e157]: Operations
            - generic [ref=e158]: Ready
            - generic "C02未提供延迟" [ref=e160]: —
            - generic "C02未提供可用率" [ref=e161]: —
            - code [ref=e162]: 10:42:06
          - generic [ref=e163]:
            - generic [ref=e164]: Strategy
            - generic [ref=e165]: Ready
            - generic "C02未提供延迟" [ref=e167]: —
            - generic "C02未提供可用率" [ref=e168]: —
            - code [ref=e169]: 10:42:06
          - link "打开 Operations" [ref=e170] [cursor=pointer]:
            - /url: /operations
            - text: 打开 Operations
            - generic [ref=e171]: ›
      - region "关键状态" [ref=e172]:
        - article [ref=e173]:
          - generic [ref=e174]: ▤
          - generic [ref=e175]:
            - heading "数据新鲜度" [level=3] [ref=e176]
            - strong [ref=e177]: 2.0s
            - paragraph [ref=e178]: fresh
            - paragraph [ref=e179]: 采样时数据年龄
            - generic "2026-08-14T10:42:06+08:00" [ref=e180]: 截至 10:42:06
        - article [ref=e181]:
          - generic [ref=e182]: "!"
          - generic [ref=e183]:
            - heading "开放风险" [level=3] [ref=e184]
            - strong [ref=e185]: "2"
            - paragraph [ref=e186]: normal
            - generic "2026-08-14T10:42:06+08:00" [ref=e187]: 截至 10:42:06
        - article [ref=e188]:
          - generic [ref=e189]: ▤
          - generic [ref=e190]:
            - heading "订单状态" [level=3] [ref=e191]
            - strong [ref=e192]: "18"
            - paragraph [ref=e193]: 12 Filled · 0 Rejected
            - paragraph [ref=e194]: 已提交订单 · PAPER
            - generic "2026-08-14T10:42:06+08:00" [ref=e195]: 截至 10:42:06
        - article [ref=e196]:
          - generic [ref=e197]: ⌁
          - generic [ref=e198]:
            - heading "运行任务" [level=3] [ref=e199]
            - strong [ref=e200]: "4"
            - paragraph [ref=e201]: 1 Failed
            - generic "2026-08-14T10:42:06+08:00" [ref=e202]: 截至 10:42:06
      - generic [ref=e203]:
        - region [ref=e204]:
          - heading "最近活动" [level=2] [ref=e206]
          - table "最近活动" [ref=e207]:
            - row [ref=e208]:
              - columnheader "时间" [ref=e209]
              - columnheader "Actor" [ref=e210]
              - columnheader "对象" [ref=e211]
              - columnheader "状态" [ref=e212]
              - columnheader "对象 ID" [ref=e213]
              - columnheader "详情" [ref=e214]
            - row [ref=e215]:
              - cell "10:36:08" [ref=e216]
              - cell "—" [ref=e217]
              - cell "订单" [ref=e218]
              - cell "filled" [ref=e219]
              - cell "88888888…" [ref=e221]
              - cell [ref=e222]:
                - link "查看订单 88888888-8888-4888-8888-888888888888" [ref=e223] [cursor=pointer]:
                  - /url: /orders/88888888-8888-4888-8888-888888888888
                  - text: 查看 ›
          - button "查看全部活动（1）" [ref=e224] [cursor=pointer]:
            - text: 查看全部活动（1）
            - generic [ref=e225]: ›
        - region [ref=e226]:
          - heading "快速开始" [level=2] [ref=e228]
          - button "发起研究 进入研究模块后重新验证创建权限" [disabled] [ref=e229]:
            - generic [ref=e230]: ♙
            - strong [ref=e231]:
              - text: 发起研究
              - generic [ref=e232]: 进入研究模块后重新验证创建权限
            - generic [ref=e233]: ›
          - button "创建策略草稿 进入策略模块后重新验证写权限" [disabled] [ref=e234]:
            - generic [ref=e235]: ▧
            - strong [ref=e236]:
              - text: 创建策略草稿
              - generic [ref=e237]: 进入策略模块后重新验证写权限
            - generic [ref=e238]: ›
          - generic [ref=e239]:
            - link "查看研究 ›" [ref=e240] [cursor=pointer]:
              - /url: /research
            - link "打开审计 ›" [ref=e241] [cursor=pointer]:
              - /url: /audit
          - status [ref=e242]: 只读监控 · 默认布局
      - paragraph [ref=e243]: 每类最多展示 50 项；数据为服务端有界快照，空列表不代表完整历史为空。
      - group [ref=e244]:
        - generic "Command 数据与操作说明" [ref=e245] [cursor=pointer]
    - contentinfo "连接状态" [ref=e246]:
      - status [ref=e247]:
        - paragraph [ref=e248]: ● Connected
        - paragraph [ref=e249]: Read-only snapshot; refresh revalidates
      - generic [ref=e250]: HTTP 快照 · 未订阅实时流
      - generic "2026-08-14T10:42:08+08:00" [ref=e251]: Sampled 10:42:08 UTC+08
  - alert [ref=e252]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import { AxeBuilder } from "@axe-core/playwright";
  3  | 
  4  | /**
  5  |  * PRE-06 基线 E2E：/command（关联 ACC-GS-S1、ACC-P02-S1）。
  6  |  * 后续每个 UI-Pxx 任务在同一目录追加页面 spec（七态 + 键盘 + 视觉）。
  7  |  * 视觉基线按平台入库（<name>-chromium-<platform>.png）；本平台基线缺失时测试失败，
  8  |  * 由 QA 在对应平台 runner 生成并提交基线（见 docs/execution/PRE-06-summary.md 遗留项 3）。
  9  |  * 视觉门禁有效性由 scripts/pre06-sabotage-check.mjs 独立保证。
  10 |  */
  11 | 
  12 | test.describe("Command Center（/command）", () => {
  13 |   test("静态首屏只渲染守卫状态，不提前泄露 Command 投影", async ({ request }) => {
  14 |     const response = await request.get("/command");
  15 |     const html = await response.text();
  16 |     expect(html).toContain('data-guard-state="checking"');
  17 |     expect(html).not.toContain('data-smoke="route-/command"');
  18 |     expect(html).not.toContain("Research run-1842");
  19 |   });
  20 | 
  21 |   test("路由可打开且渲染共享壳标记", async ({ page }) => {
  22 |     await page.goto("/command");
  23 |     const guard = page.locator('[data-guard-state="allowed"]');
  24 |     await expect(guard).toHaveAttribute("data-guard-steps", "session,tenant_workspace,rbac_capability,resource,mode,data_freshness");
  25 |     await expect(page.locator('[data-smoke="route-/command"]')).toBeVisible();
  26 |     await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  27 |     await expect(page.locator('[data-contract-mode="mocked"]')).toBeVisible();
  28 |     await expect(page.getByText(/C02 Runtime Guard Mocked/)).toBeVisible();
  29 |   });
  30 | 
  31 |   test("复用 UI-103 的 freshness、risk 与 connection 领域组件", async ({ page }) => {
  32 |     await page.goto("/command");
  33 |     await expect(page.locator(".freshness-status").getByRole("status", { name: "Live" })).toBeVisible();
  34 |     await expect(page.locator(".risk-status").getByRole("status", { name: "Allowed" })).toBeVisible();
  35 |     const connection = page.locator(".terminal-statusbar .q-alert");
  36 |     await expect(connection).toContainText("Connected");
  37 |     await expect(connection).toHaveAttribute("aria-live", "polite");
  38 |   });
  39 | 
  40 |   test("axe 无严重/高等级可访问性问题（执行计划 7.1）", async ({ page }) => {
  41 |     await page.goto("/command");
  42 |     const results = await new AxeBuilder({ page }).analyze();
  43 |     const blocking = results.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
> 44 |     expect(blocking).toEqual([]);
     |                      ^ Error: expect(received).toEqual(expected) // deep equality
  45 |   });
  46 | 
  47 |   test("优先级筛选与侧栏折叠可交互", async ({ page }) => {
  48 |     await page.goto("/command");
  49 |     await page.getByRole("button", { name: "信息 0" }).click();
  50 |     await expect(page.getByText("当前没有需要你处理的事项。")).toBeVisible();
  51 |     await page.getByRole("button", { name: "折叠侧栏" }).click();
  52 |     await expect(page.locator("[data-ui101-shell]")).toHaveClass(/sidebar-collapsed/);
  53 |     await expect(page.getByRole("button", { name: "展开侧栏" })).toBeVisible();
  54 |   });
  55 | 
  56 |   test("390px 小屏保持只读监控并隐藏高风险入口", async ({ page }) => {
  57 |     await page.setViewportSize({ width: 390, height: 844 });
  58 |     await page.goto("/command");
  59 |     await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  60 |     await expect(page.locator(".high-risk-action").first()).toBeHidden();
  61 |     await expect(page.getByLabel("连接状态")).toBeVisible();
  62 |     expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  63 |     expect(await page.locator(".activity-table").evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  64 |   });
  65 | 
  66 |   test("视觉基线：1440 深主题", async ({ page }) => {
  67 |     const snapshot = "command-1440-dark";
  68 |     await page.emulateMedia({ colorScheme: "dark" });
  69 |     await page.goto("/command");
  70 |     await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  71 |     await expect(page).toHaveScreenshot(`${snapshot}.png`, { maxDiffPixelRatio: 0.005 });
  72 |   });
  73 | });
  74 | 
```