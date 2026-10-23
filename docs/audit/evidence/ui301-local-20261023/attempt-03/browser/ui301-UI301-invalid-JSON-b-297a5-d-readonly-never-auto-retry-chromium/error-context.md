# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui301.spec.ts >> UI301 invalid JSON, backend rejection and readonly never auto retry
- Location: tests/e2e/ui301.spec.ts:23:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('服务端拒绝草稿内容，请修正后保存。', { exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('服务端拒绝草稿内容，请修正后保存。', { exact: true })

```

```yaml
- link "跳至正文":
  - /url: "#_r_0_"
- banner:
  - button "折叠侧栏" [expanded]: SUMALPHA
  - text: ▣ Workspace 33333333 Account 44444444 PAPER
  - textbox "全局搜索" [disabled]:
    - /placeholder: 搜索  ⌘K
  - button "通知" [disabled]: ♧
  - link "帮助":
    - /url: "#strategy-help"
    - text: "?"
  - link "打开个人设置":
    - /url: /settings/profile
    - text: "11"
- complementary "主导航":
  - navigation:
    - link "Command":
      - /url: /command
    - link "Research":
      - /url: /research
    - link "Strategy":
      - /url: /strategies
    - link "Trade":
      - /url: /trade
    - link "Proposals":
      - /url: /proposals
    - link "Approvals":
      - /url: /approvals
    - link "Orders":
      - /url: /orders
    - link "Audit":
      - /url: /audit
    - link "Operations":
      - /url: /operations
- main:
  - navigation "Strategy 导航":
    - link "策略目录":
      - /url: /strategies
    - text: / Lab 草稿
  - heading "Strategy Lab" [level=1]
  - alert: 服务端拒绝草稿内容，请修正后保存。 关联 ID：aaaaaaaa-1111-4111-8111-111111111111
  - region "Lab 草稿":
    - paragraph: 策略 ID：01a1673b-d4b3-76b0-a686-fb2e1538e99f
    - status: 自动保存已暂停，请手动保存 · objectVersion：1
    - paragraph: 数据快照：01a1673b-d4a7-7c32-b2c6-08a8abaac04c · 更新时间：2026-10-23T05:28:56.755536Z
    - group "编辑草稿":
      - text: 编辑草稿 文件 JSON
      - textbox "文件 JSON": "{ \"strategy.rule\": \"momentum(close, lookback=6)\" }"
      - text: 参数 JSON
      - textbox "参数 JSON": "{ \"parameters\": { \"entry_threshold_bps\": 20, \"exit_threshold_bps\": -10, \"lookback\": 6, \"max_position_notional\": \"1000\", \"universe\": [ \"BTCUSDT\" ] }, \"rule\": \"momentum\", \"rule_source\": \"momentum(close, lookback=6)\" }"
    - button "保存草稿"
  - group: 保存与恢复说明
- contentinfo "连接状态": Strategy · 当前授权范围 · paper
- alert
```

# Test source

```ts
  1  | import {test,expect} from "@playwright/test";
  2  | import AxeBuilder from "@axe-core/playwright";
  3  | import {writeFile} from "node:fs/promises";
  4  | import {authorized,openLab,control,fault,networkRows} from "./fixtures/ui301-reference";
  5  | const browserWrites = () => networkRows().filter(r => r.method === "PUT" && !r.control);
  6  | test("UI301 catalog/deep Lab autosave versions and no browser create endpoint",async ({page}) => {
  7  |  const path = await openLab(page), before = (await control(path.replace("/lab","/draft").replace("/strategies/","/v1/strategies/"))).body;
  8  |  const files = {...before.files as Record<string,string>,"notes.txt":"browser autosave"};await page.getByLabel("文件 JSON",{exact:true}).fill(JSON.stringify(files));
  9  |  await expect(page.getByRole("status").filter({hasText:"已保存"})).toContainText(`objectVersion：${BigInt(before.objectVersion as string)+1n}`);expect(browserWrites()).toHaveLength(1);expect(browserWrites()[0].version).toBe(before.objectVersion);
  10 |  const api = path.replace("/lab","/draft").replace("/strategies/","/v1/strategies/");expect((await control(api)).body.files).toEqual(files);
  11 |  await page.goto(path);await authorized(page);await expect(page.getByLabel("文件 JSON",{exact:true})).toHaveValue(/browser autosave/);await page.goto("/strategies/new");await authorized(page);await expect(page.getByText("策略由服务端注册",{exact:true})).toBeVisible();expect(networkRows().some(r => r.method === "POST")).toBe(false);
  12 | });
  13 | test("UI301 true competing save produces 409 diff; explicit merge never overwrites newer server head",async ({page}) => {
  14 |  const path = await openLab(page),api = path.replace("/lab","/draft").replace("/strategies/","/v1/strategies/"),before = (await control(api)).body;
  15 |  expect((await control(api,{files:{...before.files as Record<string,string>,"notes.txt":"remote change"},parameters:before.parameters},before.objectVersion as string)).status).toBe(200);
  16 |  await page.getByLabel("文件 JSON",{exact:true}).fill(JSON.stringify({...before.files as Record<string,string>,"notes.txt":"local change"}));await expect(page.getByRole("region",{name:"草稿冲突 diff"})).toBeVisible();await expect(page.getByRole("region",{name:"逐字段差异"})).toContainText("remote change");await expect(page.getByLabel("文件 JSON",{exact:true})).toHaveValue(/local change/);
  17 |  expect((await control(api)).body.files).toHaveProperty(["notes.txt"],"remote change");expect(browserWrites()).toHaveLength(1);
  18 |  await page.getByLabel("文件 JSON",{exact:true}).fill(JSON.stringify({...before.files as Record<string,string>,"notes.txt":"merged local and remote"}));await page.getByRole("button",{name:"确认使用当前编辑合并",exact:true}).click();expect(browserWrites()).toHaveLength(1);await page.getByRole("button",{name:"保存草稿",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"已保存"})).toBeVisible();expect((await control(api)).body.files).toHaveProperty(["notes.txt"],"merged local and remote");
  19 | });
  20 | test("UI301 committed response lost: pause and reuse same key/body/version on explicit retry",async ({page}) => {
  21 |  await openLab(page);fault({drop:true});const f = page.getByLabel("文件 JSON",{exact:true});const files = JSON.parse(await f.inputValue());files["notes.txt"] = "lost response";await f.fill(JSON.stringify(files));await expect(page.getByRole("button",{name:"以原请求重试保存",exact:true})).toBeVisible();await expect(f).toBeDisabled();expect(browserWrites()).toHaveLength(1);await page.getByRole("button",{name:"以原请求重试保存",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"已保存"})).toBeVisible();const [a,b] = browserWrites();expect(a.keyHash).toBe(b.keyHash);expect(a.bodyHash).toBe(b.bodyHash);expect(a.version).toBe(b.version);expect(a.responseHash).toBe(b.responseHash);
  22 | });
  23 | test("UI301 invalid JSON, backend rejection and readonly never auto retry",async ({page}) => {
> 24 |  await openLab(page);const f = page.getByLabel("文件 JSON",{exact:true}),files = await f.inputValue();await f.fill("bad json");await expect(page.getByText(/内容须为有效 JSON/)).toBeVisible();await page.waitForTimeout(1200);expect(browserWrites()).toHaveLength(0);fault({invalid:true});await f.fill(files);await expect(page.getByText("服务端拒绝草稿内容，请修正后保存。",{exact:true})).toBeVisible();await page.waitForTimeout(1200);expect(browserWrites()).toHaveLength(1);await expect(page.locator("main")).not.toContainText("private SQL");
     |                                                                                                                                                                                                                                                                                                                                                                         ^ Error: expect(locator).toBeVisible() failed
  25 |  fault({readonly:true});await page.reload();await authorized(page);await expect(page.getByLabel("文件 JSON",{exact:true})).toBeDisabled();await expect(page.getByText("当前身份仅可读取草稿。",{exact:true})).toBeVisible();
  26 | });
  27 | test("UI301 access loss clears draft; explicit recovery never replays save",async ({page}) => {
  28 |  await openLab(page);await page.getByLabel("文件 JSON",{exact:true}).fill("invalid unsaved content");await page.evaluate(() => window.dispatchEvent(new Event("offline")));await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.getByLabel("文件 JSON",{exact:true})).toHaveCount(0);await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await authorized(page);await expect(page.getByLabel("文件 JSON",{exact:true})).not.toHaveValue("invalid unsaved content");expect(browserWrites()).toHaveLength(0);
  29 | });
  30 | test("UI301 real pages retain desktop/mobile dark/light axe and screenshots",async ({page},info) => {
  31 |  const path = await openLab(page),scans = [];
  32 |  for (const theme of ["dark","light"] as const) {await page.emulateMedia({colorScheme:theme});for (const route of ["/strategies","/strategies/new",path]) {await page.goto(route);await authorized(page);if (route === path) await expect(page.getByLabel("文件 JSON",{exact:true})).toBeVisible();for (const width of [1440,390]) {await page.setViewportSize({width,height:900});expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);const scan = await new AxeBuilder({page}).analyze();scans.push({theme,route,width,violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath("axe.json"),JSON.stringify({scans,manualScreenReader:"NOT_RUN",nativeZoom200:"NOT_RUN"},null,2));expect(scan.violations).toEqual([]);await page.screenshot({path:info.outputPath(`ui301-${route === path ? "lab" : route.endsWith("new") ? "new" : "catalog"}-${theme}-${width}.png`),fullPage:true});}}}
  33 | });
  34 | 
```