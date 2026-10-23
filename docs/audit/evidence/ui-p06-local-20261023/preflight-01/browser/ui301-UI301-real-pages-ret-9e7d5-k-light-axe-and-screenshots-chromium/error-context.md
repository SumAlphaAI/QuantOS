# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui301.spec.ts >> UI301 real pages retain desktop/mobile dark/light axe and screenshots
- Location: tests/e2e/ui301.spec.ts:30:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 45

- Array []
+ Array [
+   Object {
+     "description": "Ensure landmarks are unique",
+     "help": "Landmarks should have a unique role or role/label/title (i.e. accessible name) combination",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.13/landmark-unique?application=playwright",
+     "id": "landmark-unique",
+     "impact": "moderate",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "accessibleText": null,
+               "role": "complementary",
+             },
+             "id": "landmark-is-unique",
+             "impact": "moderate",
+             "message": "The landmark must have a unique aria-label, aria-labelledby, or title to make landmarks distinguishable",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<aside class=\"p06-right\">",
+                 "target": Array [
+                   ".p06-right",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   The landmark must have a unique aria-label, aria-labelledby, or title to make landmarks distinguishable",
+         "html": "<aside class=\"p06-left\">",
+         "impact": "moderate",
+         "none": Array [],
+         "target": Array [
+           ".p06-left",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.semantics",
+       "best-practice",
+     ],
+   },
+ ]
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
  11 |  await page.goto(path);await authorized(page);await page.getByRole("tab",{name:"全部文件 JSON",exact:true}).click();await expect(page.getByLabel("文件 JSON",{exact:true})).toHaveValue(/browser autosave/);await page.goto("/strategies/new");await authorized(page);await expect(page.getByText("策略由服务端注册",{exact:true})).toBeVisible();expect(networkRows().some(r => r.method === "POST")).toBe(false);
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
  24 |  await openLab(page);const f = page.getByLabel("文件 JSON",{exact:true}),files = await f.inputValue();await f.fill("bad json");await expect(page.getByText(/内容须为有效 JSON/)).toBeVisible();await page.waitForTimeout(1200);expect(browserWrites()).toHaveLength(0);fault({invalid:true});await f.fill(files);await expect(page.locator("main").getByRole("alert").filter({hasText:"服务端拒绝草稿内容，请修正后保存。"})).toBeVisible();await page.waitForTimeout(1200);expect(browserWrites()).toHaveLength(1);await expect(page.locator("main")).not.toContainText("private SQL");
  25 |  fault({readonly:true});await page.reload();await authorized(page);await page.getByRole("tab",{name:"全部文件 JSON",exact:true}).click();await expect(page.getByLabel("文件 JSON",{exact:true})).toBeDisabled();await expect(page.getByText("当前身份仅可读取草稿。",{exact:true})).toBeVisible();
  26 | });
  27 | test("UI301 access loss clears draft; explicit recovery never replays save",async ({page}) => {
  28 |  await openLab(page);await page.getByLabel("文件 JSON",{exact:true}).fill("invalid unsaved content");await page.evaluate(() => window.dispatchEvent(new Event("offline")));await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.getByLabel("文件 JSON",{exact:true})).toHaveCount(0);await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await authorized(page);await page.getByRole("tab",{name:"全部文件 JSON",exact:true}).click();await expect(page.getByLabel("文件 JSON",{exact:true})).not.toHaveValue("invalid unsaved content");expect(browserWrites()).toHaveLength(0);
  29 | });
  30 | test("UI301 real pages retain desktop/mobile dark/light axe and screenshots",async ({page},info) => {
  31 |  const path = await openLab(page),scans = [];
> 32 |  for (const theme of ["dark","light"] as const) {await page.emulateMedia({colorScheme:theme});for (const route of ["/strategies","/strategies/new",path]) {await page.goto(route);await authorized(page);if (route === path) await expect(page.getByLabel("文件内容",{exact:true})).toBeVisible();for (const width of [1440,390]) {await page.setViewportSize({width,height:900});expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);const scan = await new AxeBuilder({page}).analyze();scans.push({theme,route,width,violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath("axe.json"),JSON.stringify({scans,manualScreenReader:"NOT_RUN",nativeZoom200:"NOT_RUN"},null,2));expect(scan.violations).toEqual([]);await page.screenshot({path:info.outputPath(`ui301-${route === path ? "lab" : route.endsWith("new") ? "new" : "catalog"}-${theme}-${width}.png`),fullPage:true});}}}
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   ^ Error: expect(received).toEqual(expected) // deep equality
  33 | });
  34 | 
```