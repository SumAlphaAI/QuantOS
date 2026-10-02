# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: command.spec.ts >> Command Center（/command） >> 视觉基线：1440 深主题
- Location: tests/e2e/command.spec.ts:66:7

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  1199895 pixels (ratio 0.93 of all image pixels) are different.

  Snapshot: command-1440-dark.png

Call log:
  - Expect "toHaveScreenshot(command-1440-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 1199895 pixels (ratio 0.93 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 1199895 pixels (ratio 0.93 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - banner [ref=e5]:
      - button "折叠侧栏" [ref=e6] [cursor=pointer]:
        - emphasis [ref=e10]
        - generic [ref=e11]: SUMALPHA
      - button "Primary workspace" [ref=e13] [cursor=pointer]:
        - generic [ref=e14]: ▣
        - text: Primary workspace
        - generic [ref=e15]: ⌄
      - button "Paper Account 01" [ref=e16] [cursor=pointer]:
        - text: Paper Account 01
        - generic [ref=e17]: ⌄
      - generic [ref=e18]: PAPER
      - status "live" [ref=e21]:
        - generic [ref=e22]: ●
      - status "allow" [ref=e26]:
        - generic [ref=e27]: ●
      - generic [ref=e29]:
        - generic [ref=e30]: ⌕
        - textbox "全局搜索" [ref=e31]:
          - /placeholder: 搜索  ⌘K
      - button "通知，3 条未读" [ref=e32] [cursor=pointer]:
        - text: ♧
        - generic [ref=e33]: "3"
      - button "帮助" [ref=e34] [cursor=pointer]: "?"
      - link "打开个人设置" [ref=e35] [cursor=pointer]:
        - /url: /settings/profile
        - text: AN
    - complementary "主导航" [ref=e36]:
      - navigation [ref=e37]:
        - link "Command" [ref=e38] [cursor=pointer]:
          - /url: /command
          - generic [ref=e39]: ⌂
        - link "Research" [ref=e41] [cursor=pointer]:
          - /url: /research
          - generic [ref=e42]: ◉
        - link "Strategy" [ref=e44] [cursor=pointer]:
          - /url: /strategies
          - generic [ref=e45]: ↗
        - link "Portfolio" [ref=e47] [cursor=pointer]:
          - /url: /portfolio
          - generic [ref=e48]: ◔
        - link "Markets" [ref=e50] [cursor=pointer]:
          - /url: /markets
          - generic [ref=e51]: ▥
        - link "Trade" [ref=e53] [cursor=pointer]:
          - /url: /trade
          - generic [ref=e54]: ⇄
        - link "Performance" [ref=e56] [cursor=pointer]:
          - /url: /performance
          - generic [ref=e57]: ▥
        - link "Proposals" [ref=e59] [cursor=pointer]:
          - /url: /proposals
          - generic [ref=e60]: ▤
        - link "Approvals 3 条待处理" [ref=e62] [cursor=pointer]:
          - /url: /approvals
          - generic [ref=e63]: ✓
          - generic [ref=e64]: Approvals
          - generic "3 条待处理" [ref=e65]: "3"
        - link "Orders" [ref=e66] [cursor=pointer]:
          - /url: /orders
          - generic [ref=e67]: ▣
        - link "Audit" [ref=e69] [cursor=pointer]:
          - /url: /audit
          - generic [ref=e70]: ▥
        - link "Operations" [ref=e72] [cursor=pointer]:
          - /url: /operations
          - generic [ref=e73]: ≋
        - link "Admin" [ref=e75] [cursor=pointer]:
          - /url: /admin/members
          - generic [ref=e76]: ⚙
    - main [ref=e78]:
      - status [ref=e79]: C02 Runtime Guard Mocked · 六步守卫已在页面渲染前执行；Command 聚合契约等待 BFF-FE-002 签署。
      - generic [ref=e80]:
        - generic [ref=e81]:
          - generic [ref=e82]:
            - generic [ref=e83]: Home
            - generic [ref=e84]: /
            - strong [ref=e85]: Command
          - heading "Command Center" [level=1] [ref=e86]
          - paragraph [ref=e87]: 主工作区的研究、风险与运行状态。
        - generic [ref=e88]:
          - button "全部账户 ⌄" [ref=e89] [cursor=pointer]:
            - text: 全部账户
            - generic [ref=e90]: ⌄
          - button "今日 ⌄" [ref=e91] [cursor=pointer]:
            - text: 今日
            - generic [ref=e92]: ⌄
          - button "刷新" [ref=e93] [cursor=pointer]: ↻
          - button "布局设置" [ref=e94] [cursor=pointer]: ⊞
          - generic [ref=e95]: Last sync 10:42:08
      - region "当前运行模式" [ref=e96]:
        - generic [ref=e97]: ♢
        - strong [ref=e98]: PAPER
        - generic [ref=e99]: ·
        - generic [ref=e100]: 模拟账本。不会向交易所提交订单。
        - generic [ref=e102]:
          - status "allow" [ref=e103]:
            - generic [ref=e104]: ●
          - generic [ref=e106]: 主工作区风险规则正常
      - generic [ref=e107]:
        - generic [ref=e108]:
          - generic [ref=e109]:
            - heading "优先处理" [level=2] [ref=e110]
            - generic "优先级筛选" [ref=e111]:
              - button "全部" [ref=e112] [cursor=pointer]
              - button "严重 2" [ref=e113] [cursor=pointer]
              - button "警告 1" [ref=e114] [cursor=pointer]
              - button "信息 0" [ref=e115] [cursor=pointer]
          - generic [ref=e116]:
            - generic [ref=e117]:
              - generic [ref=e118]: △
              - strong [ref=e119]: 审批待办
              - generic [ref=e120]: 策略 release-042 等待风险审批
              - code [ref=e121]: 6 分钟
              - button "查看审批 ›" [ref=e122] [cursor=pointer]
            - generic [ref=e123]:
              - generic [ref=e124]: "!"
              - strong [ref=e125]: 风险告警
              - generic [ref=e126]: BTCUSDT 数据新鲜度接近阈值
              - code [ref=e127]: 2 分钟
              - button "查看风险 ›" [ref=e128] [cursor=pointer]
            - generic [ref=e129]:
              - generic [ref=e130]: "!"
              - strong [ref=e131]: 失败任务
              - generic [ref=e132]: Research run-1842 执行失败
              - code [ref=e133]: corr-7f2a…
              - button "查看任务 ›" [ref=e134] [cursor=pointer]
          - button "查看全部待办 ›" [ref=e135] [cursor=pointer]
        - generic [ref=e136]:
          - heading "系统健康" [level=2] [ref=e138]
          - generic [ref=e139]:
            - generic [ref=e140]: 服务
            - generic [ref=e141]: 状态
            - generic [ref=e142]: 延迟/性能
            - generic [ref=e143]: 可用性
            - generic [ref=e144]: 更新时间
          - generic [ref=e145]:
            - generic [ref=e146]: Market Data
            - generic [ref=e147]: Healthy
            - generic [ref=e149]: 1.2s
            - img "可用性 5/5" [ref=e150]
            - code [ref=e156]: 10:42:08
          - generic [ref=e157]:
            - generic [ref=e158]: Engine Runtime
            - generic [ref=e159]: Degraded
            - generic [ref=e161]: P95 820ms
            - img "可用性 3/5" [ref=e162]
            - code [ref=e168]: 10:42:08
          - generic [ref=e169]:
            - generic [ref=e170]: Event Projection
            - generic [ref=e171]: Healthy
            - generic [ref=e173]: 0.8s
            - img "可用性 5/5" [ref=e174]
            - code [ref=e180]: 10:42:08
          - generic [ref=e181]:
            - generic [ref=e182]: Execution Gateway
            - generic [ref=e183]: Healthy
            - generic [ref=e185]: 12ms
            - img "可用性 5/5" [ref=e186]
            - code [ref=e192]: 10:42:08
          - button "打开 Operations ›" [ref=e193] [cursor=pointer]
      - region "关键状态" [ref=e194]:
        - article [ref=e195]:
          - generic [ref=e196]: ▤
          - generic [ref=e197]:
            - heading "数据新鲜度" [level=3] [ref=e198]
            - strong [ref=e199]: 1.2s
            - paragraph [ref=e200]: Fresh
            - generic [ref=e201]: 截至 10:42:08
        - article [ref=e202]:
          - generic [ref=e203]: "!"
          - generic [ref=e204]:
            - heading "开放风险" [level=3] [ref=e205]
            - strong [ref=e206]: "2"
            - paragraph [ref=e207]: 1 Critical
            - generic [ref=e208]: 截至 10:42:08
        - article [ref=e209]:
          - generic [ref=e210]: ▣
          - generic [ref=e211]:
            - heading "订单状态" [level=3] [ref=e212]
            - strong [ref=e213]: "18"
            - paragraph [ref=e214]: 2 待确认
            - generic [ref=e215]: 截至 10:42:08
        - article [ref=e216]:
          - generic [ref=e217]: ⌁
          - generic [ref=e218]:
            - heading "运行任务" [level=3] [ref=e219]
            - strong [ref=e220]: "4"
            - paragraph [ref=e221]: 1 Failed
            - generic [ref=e222]: 截至 10:42:08
      - generic [ref=e223]:
        - generic [ref=e224]:
          - heading "最近活动" [level=2] [ref=e226]
          - table "最近活动" [ref=e227]:
            - row [ref=e228]:
              - columnheader "时间" [ref=e229]
              - columnheader "Actor" [ref=e230]
              - columnheader "对象" [ref=e231]
              - columnheader "状态" [ref=e232]
              - columnheader "关联 ID" [ref=e233]
              - columnheader "详情" [ref=e234]
            - row [ref=e235]:
              - cell "10:41:33" [ref=e236]
              - cell "Jane Smith" [ref=e237]
              - cell "Research run-1842" [ref=e238]
              - cell "Completed" [ref=e239]
              - cell "corr-7f2a…" [ref=e240]
              - cell [ref=e241]:
                - button "查看研究" [ref=e242] [cursor=pointer]
            - row [ref=e243]:
              - cell "10:40:12" [ref=e244]
              - cell "Mike Chen" [ref=e245]
              - cell "Artifact art-9c31" [ref=e246]
              - cell "Archived" [ref=e247]
              - cell "corr-8b4d…" [ref=e248]
              - cell [ref=e249]:
                - button "查看工作" [ref=e250] [cursor=pointer]
            - row [ref=e251]:
              - cell "10:38:55" [ref=e252]
              - cell "Yuki Sato" [ref=e253]
              - cell "Strategy release-042" [ref=e254]
              - cell "Submitted" [ref=e255]
              - cell "corr-3d91…" [ref=e256]
              - cell [ref=e257]:
                - button "查看策略" [ref=e258] [cursor=pointer]
            - row [ref=e259]:
              - cell "10:37:21" [ref=e260]
              - cell "Risk Manager" [ref=e261]
              - cell "release-042 风险审批" [ref=e262]
              - cell "Approval required" [ref=e263]
              - cell "corr-1a7c…" [ref=e264]
              - cell [ref=e265]:
                - button "查看审批" [ref=e266] [cursor=pointer]
            - row [ref=e267]:
              - cell "10:36:08" [ref=e268]
              - cell "Ops Bot" [ref=e269]
              - cell "Paper Order po-7f8d" [ref=e270]
              - cell "Filled" [ref=e271]
              - cell "corr-5e2b…" [ref=e272]
              - cell [ref=e273]:
                - button "查看订单" [ref=e274] [cursor=pointer]
          - button "查看全部活动 ›" [ref=e275] [cursor=pointer]
        - generic [ref=e276]:
          - heading "快速开始" [level=2] [ref=e278]
          - button "发起研究 选择数据快照与 Engine ›" [ref=e279] [cursor=pointer]:
            - generic [ref=e280]: ♙
            - strong [ref=e281]:
              - text: 发起研究
              - generic [ref=e282]: 选择数据快照与 Engine
            - generic [ref=e283]: ›
          - button "创建策略草稿 从受控研究证据开始 ›" [ref=e284] [cursor=pointer]:
            - generic [ref=e285]: ▧
            - strong [ref=e286]:
              - text: 创建策略草稿
              - generic [ref=e287]: 从受控研究证据开始
            - generic [ref=e288]: ›
          - generic [ref=e289]:
            - button "▥ 查看市场 ›" [ref=e290] [cursor=pointer]
            - button "♢ 打开审计 ›" [ref=e291] [cursor=pointer]
          - paragraph [ref=e292]: ✓ 布局已保存
    - contentinfo "连接状态" [ref=e293]:
      - status [ref=e294]:
        - paragraph [ref=e295]: ● Connected
        - paragraph [ref=e296]:
          - text: Live updates enabled · last connected
          - time [ref=e297]: 2026-08-14T02:42:08.000Z
      - generic [ref=e298]: "Data latency: 1.2s"
      - generic [ref=e299]: Last sync 10:42:08
  - alert [ref=e300]
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
  8  |  * 由 QA 在对应平台 runner 生成并提交基线（见 docs/PRE-06-summary.md 遗留项 3）。
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
  33 |     await expect(page.locator(".freshness-status").getByRole("status", { name: "live" })).toBeVisible();
  34 |     await expect(page.locator(".risk-status").getByRole("status", { name: "allow" })).toBeVisible();
  35 |     const connection = page.locator(".terminal-statusbar .q-alert");
  36 |     await expect(connection).toContainText("Connected");
  37 |     await expect(connection).toHaveAttribute("aria-live", "polite");
  38 |   });
  39 | 
  40 |   test("axe 无严重/高等级可访问性问题（执行计划 7.1）", async ({ page }) => {
  41 |     await page.goto("/command");
  42 |     const results = await new AxeBuilder({ page }).analyze();
  43 |     const blocking = results.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
  44 |     expect(blocking).toEqual([]);
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
  68 |     await page.goto("/command");
  69 |     await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
> 70 |     await expect(page).toHaveScreenshot(`${snapshot}.png`, { maxDiffPixelRatio: 0.005 });
     |                        ^ Error: expect(page).toHaveScreenshot(expected) failed
  71 |   });
  72 | });
  73 | 
```