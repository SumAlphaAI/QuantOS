# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui301.spec.ts >> UI301 invalid JSON, backend rejection and readonly never auto retry
- Location: tests/e2e/ui301.spec.ts:24:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('main').getByRole('alert').filter({ hasText: '服务端拒绝草稿内容，请修正后保存。' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('main').getByRole('alert').filter({ hasText: '服务端拒绝草稿内容，请修正后保存。' })

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
    - text: / Strategy Lab
  - heading "Strategy Lab" [level=1]
  - strong: Owned momentum
  - text: 草稿 v1 01a16792-832f-77b2-bf50-ecdeb252e212
  - button "切换主题": ◐
  - button "运行静态检查" [disabled]
  - button "创建回测" [disabled]
  - button "提交发布候选" [disabled]
  - strong: 策略草稿不能直接交易。
  - text: 请完成验证、回测和审批。
  - alert: 服务端拒绝当前内容或检查，请修正草稿并保存后重试。 关联 ID：aaaaaaaa-1111-4111-8111-111111111111
  - complementary "策略目录与文件":
    - region "策略目录":
      - heading "策略目录" [level=2]
      - text: 本页 2 搜索本页策略
      - textbox "搜索本页策略"
      - link "新建策略说明":
        - /url: /strategies/new
        - text: ＋
      - group "目录视图":
        - button "卡片视图" [pressed]: ▦
        - button "表格视图": ☷
      - article:
        - link "打开 Lab：Owned momentum":
          - /url: /strategies/01a16792-832f-77b2-bf50-ecdeb252e212/lab
          - strong: Owned momentum
          - text: 01a16792…52e212 更新时间
          - time: 2026-10-23 07:03 UTC
      - article:
        - link "打开 Lab：Owned momentum alternative":
          - /url: /strategies/01a16792-8330-7f23-907a-c63de027378a/lab
          - strong: Owned momentum alternative
          - text: 01a16792…27378a 更新时间
          - time: 2026-10-23 07:03 UTC
      - paragraph: 搜索只作用于已读取的当前页。版本与状态以打开的草稿为准。
    - region "文件与版本":
      - heading "文件与版本" [level=2]
      - list:
        - listitem:
          - button "strategy.rule" [pressed]
      - heading "当前版本" [level=3]
      - text: v1 current
      - time: 07:03:37 UTC
      - paragraph: 历史版本未由 C05 返回；不推算版本列表。
      - button "比较历史版本" [disabled]
  - tablist "Lab 编辑视图":
    - tab "strategy.rule"
    - tab "参数"
    - tab "研究引用"
    - tab "全部文件 JSON" [selected]
  - text: 受控编辑器
  - status: 自动保存已暂停，请手动保存 · objectVersion：1
  - text: 草稿编辑
  - tabpanel "全部文件 JSON":
    - text: 文件 JSON
    - textbox "文件 JSON": "{ \"strategy.rule\": \"momentum(close, lookback=6)\" }"
    - text: 参数 JSON
    - textbox "参数 JSON": "{ \"parameters\": { \"entry_threshold_bps\": 20, \"exit_threshold_bps\": -10, \"lookback\": 6, \"max_position_notional\": \"1000\", \"universe\": [ \"BTCUSDT\" ] }, \"rule\": \"momentum\", \"rule_source\": \"momentum(close, lookback=6)\" }"
  - text: strategy.rule UTF-8 · 版本化保存
  - heading "参数" [level=2]
  - button "编辑参数"
  - term: entry_threshold_bps
  - definition: "20"
  - term: exit_threshold_bps
  - definition: "-10"
  - term: lookback
  - definition: "6"
  - term: max_position_notional
  - definition: "1000"
  - paragraph: 保留服务端参数类型，最终校验由服务端执行。
  - heading "固定输入" [level=2]
  - term: DataSnapshot
  - definition:
    - link "01a16792…72fa4e":
      - /url: /data-snapshots/01a16792-8323-7f31-8979-c9f3b472fa4e
  - term: ResearchArtifact
  - definition: 1 项引用
  - term: Environment hash
  - definition: 报告内核对
  - button "查看研究证据"
  - complementary "校验与实验":
    - region "Validation 面板":
      - heading "Validation" [level=2]
      - text: 当前草稿
      - list:
        - listitem:
          - strong: JSON 与请求大小
          - text: 本地校验有效
        - listitem:
          - strong: 静态检查 / Look-ahead
          - text: 未执行
        - listitem:
          - strong: 数据与许可证
          - text: 用途校验结果未提供
        - listitem:
          - strong: 依赖与隔离
          - text: 检查结果未提供
      - paragraph: 草稿保存不代表检查通过，也不能提交发布候选。
      - button "保存草稿"
    - region "实验队列":
      - heading "实验队列" [level=2]
      - text: 0 项
      - paragraph: 仅本会话已接受的任务；C05 没有全局队列查询。最多 25 项。
      - paragraph: 暂无已接受的回测任务
  - region "Backtest Queue":
    - heading "Backtest Queue" [level=2]
    - text: 固定输入 · 可复现报告
    - paragraph: 已接受任务：0。202 仅代表受理，最终状态、指标和泄漏检查以服务端报告为准。
    - text: 已有任务 ID
    - textbox "已有任务 ID"
    - button "读取已有报告"
    - paragraph: 回测结果不等于可部署策略。泄漏失败、报告缺失或版本变化阻断 Release。
  - group: 保存与恢复说明
- contentinfo "连接状态": "Connection: Authorized Draft autosave: 自动保存已暂停，请手动保存 当前授权范围 · PAPER · 非交易指令"
- alert
```

# Test source

```ts
  1  | import {test,expect} from "@playwright/test";
  2  | import AxeBuilder from "@axe-core/playwright";
  3  | import {writeFile} from "node:fs/promises";
  4  | import {authorized,openLab,control,fault,networkRows,installReferenceHooks} from "./fixtures/ui301-reference";
  5  | installReferenceHooks();
  6  | const browserWrites = () => networkRows().filter(r => r.method === "PUT" && !r.control);
  7  | test("UI301 catalog/deep Lab autosave versions and no browser create endpoint",async ({page}) => {
  8  |  const path = await openLab(page), before = (await control(path.replace("/lab","/draft").replace("/strategies/","/v1/strategies/"))).body;
  9  |  const files = {...before.files as Record<string,string>,"notes.txt":"browser autosave"};await page.getByLabel("文件 JSON",{exact:true}).fill(JSON.stringify(files));
  10 |  await expect(page.getByRole("status").filter({hasText:"已保存"})).toContainText(`objectVersion：${BigInt(before.objectVersion as string)+1n}`);expect(browserWrites()).toHaveLength(1);expect(browserWrites()[0].version).toBe(before.objectVersion);
  11 |  const api = path.replace("/lab","/draft").replace("/strategies/","/v1/strategies/");expect((await control(api)).body.files).toEqual(files);
  12 |  await page.goto(path);await authorized(page);await page.getByRole("tab",{name:"全部文件 JSON",exact:true}).click();await expect(page.getByLabel("文件 JSON",{exact:true})).toHaveValue(/browser autosave/);await page.goto("/strategies/new");await authorized(page);await expect(page.getByText("策略由服务端注册",{exact:true})).toBeVisible();expect(networkRows().some(r => r.method === "POST")).toBe(false);
  13 | });
  14 | test("UI301 true competing save produces 409 diff; explicit merge never overwrites newer server head",async ({page}) => {
  15 |  const path = await openLab(page),api = path.replace("/lab","/draft").replace("/strategies/","/v1/strategies/"),before = (await control(api)).body;
  16 |  expect((await control(api,{files:{...before.files as Record<string,string>,"notes.txt":"remote change"},parameters:before.parameters},before.objectVersion as string)).status).toBe(200);
  17 |  await page.getByLabel("文件 JSON",{exact:true}).fill(JSON.stringify({...before.files as Record<string,string>,"notes.txt":"local change"}));await expect(page.getByRole("region",{name:"草稿冲突 diff"})).toBeVisible();await expect(page.getByRole("region",{name:"逐字段差异"})).toContainText("remote change");await expect(page.getByLabel("文件 JSON",{exact:true})).toHaveValue(/local change/);
  18 |  expect((await control(api)).body.files).toHaveProperty(["notes.txt"],"remote change");expect(browserWrites()).toHaveLength(1);
  19 |  await page.getByLabel("文件 JSON",{exact:true}).fill(JSON.stringify({...before.files as Record<string,string>,"notes.txt":"merged local and remote"}));await page.getByRole("button",{name:"确认使用当前编辑合并",exact:true}).click();expect(browserWrites()).toHaveLength(1);await page.getByRole("button",{name:"保存草稿",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"已保存"})).toBeVisible();expect((await control(api)).body.files).toHaveProperty(["notes.txt"],"merged local and remote");
  20 | });
  21 | test("UI301 committed response lost: pause and reuse same key/body/version on explicit retry",async ({page}) => {
  22 |  await openLab(page);fault({drop:true});const f = page.getByLabel("文件 JSON",{exact:true});const files = JSON.parse(await f.inputValue());files["notes.txt"] = "lost response";await f.fill(JSON.stringify(files));await expect(page.getByRole("button",{name:"以原请求重试保存",exact:true})).toBeVisible();await expect(f).toBeDisabled();expect(browserWrites()).toHaveLength(1);await page.getByRole("button",{name:"以原请求重试保存",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"已保存"})).toBeVisible();const [a,b] = browserWrites();expect(a.keyHash).toBe(b.keyHash);expect(a.bodyHash).toBe(b.bodyHash);expect(a.version).toBe(b.version);expect(a.responseHash).toBe(b.responseHash);
  23 | });
  24 | test("UI301 invalid JSON, backend rejection and readonly never auto retry",async ({page}) => {
> 25 |  await openLab(page);const f = page.getByLabel("文件 JSON",{exact:true}),files = await f.inputValue();await f.fill("bad json");await expect(page.getByText(/内容须为有效 JSON/)).toBeVisible();await page.waitForTimeout(1200);expect(browserWrites()).toHaveLength(0);fault({invalid:true});await f.fill(files);await expect(page.locator("main").getByRole("alert").filter({hasText:"服务端拒绝草稿内容，请修正后保存。"})).toBeVisible();await page.waitForTimeout(1200);expect(browserWrites()).toHaveLength(1);await expect(page.locator("main")).not.toContainText("private SQL");
     |                                                                                                                                                                                                                                                                                                                                                                                                      ^ Error: expect(locator).toBeVisible() failed
  26 |  fault({readonly:true});await page.reload();await authorized(page);await page.getByRole("tab",{name:"全部文件 JSON",exact:true}).click();await expect(page.getByLabel("文件 JSON",{exact:true})).toBeDisabled();await expect(page.getByText("当前身份仅可读取草稿。",{exact:true})).toBeVisible();
  27 | });
  28 | test("UI301 access loss clears draft; explicit recovery never replays save",async ({page}) => {
  29 |  await openLab(page);await page.getByLabel("文件 JSON",{exact:true}).fill("invalid unsaved content");await page.evaluate(() => window.dispatchEvent(new Event("offline")));await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.getByLabel("文件 JSON",{exact:true})).toHaveCount(0);await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await authorized(page);await page.getByRole("tab",{name:"全部文件 JSON",exact:true}).click();await expect(page.getByLabel("文件 JSON",{exact:true})).not.toHaveValue("invalid unsaved content");expect(browserWrites()).toHaveLength(0);
  30 | });
  31 | test("UI301 real pages retain desktop/mobile dark/light axe and screenshots",async ({page},info) => {
  32 |  const path = await openLab(page),scans = [];
  33 |  for (const theme of ["dark","light"] as const) {await page.emulateMedia({colorScheme:theme});for (const route of ["/strategies","/strategies/new",path]) {await page.goto(route);await authorized(page);if (route === path) await expect(page.getByLabel("文件内容",{exact:true})).toBeVisible();for (const width of [1440,390]) {await page.setViewportSize({width,height:900});expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);const scan = await new AxeBuilder({page}).analyze();scans.push({theme,route,width,violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath("axe.json"),JSON.stringify({scans,manualScreenReader:"NOT_RUN",nativeZoom200:"NOT_RUN"},null,2));expect(scan.violations).toEqual([]);await page.screenshot({path:info.outputPath(`ui301-${route === path ? "lab" : route.endsWith("new") ? "new" : "catalog"}-${theme}-${width}.png`),fullPage:true});}}}
  34 | });
  35 | 
```