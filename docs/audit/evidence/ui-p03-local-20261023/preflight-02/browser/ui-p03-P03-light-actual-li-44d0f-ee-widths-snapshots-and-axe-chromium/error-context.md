# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p03.spec.ts >> P03 light actual list/create workbench, three widths, snapshots and axe
- Location: tests/e2e/ui-p03.spec.ts:37:49

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
+               "bgColor": "#075985",
+               "contrastRatio": 2.27,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#001e2b",
+               "fontSize": "10.5pt (14px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.27 (foreground color: #001e2b, background color: #075985, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<a class=\"p03-primary\" href=\"/research/new\" aria-label=\"新建研究\">发起研究</a>",
+                 "target": Array [
+                   "a[aria-label=\"新建研究\"]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.27 (foreground color: #001e2b, background color: #075985, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<a class=\"p03-primary\" href=\"/research/new\" aria-label=\"新建研究\">发起研究</a>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "a[aria-label=\"新建研究\"]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#075985",
+               "contrastRatio": 2.27,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#001e2b",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 2.27 (foreground color: #001e2b, background color: #075985, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<a class=\"p03-primary\" href=\"/research/new\">打开研究创建面板</a>",
+                 "target": Array [
+                   ".p03-start-hint > .p03-primary[href$=\"new\"]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 2.27 (foreground color: #001e2b, background color: #075985, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<a class=\"p03-primary\" href=\"/research/new\">打开研究创建面板</a>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".p03-start-hint > .p03-primary[href$=\"new\"]",
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

# Test source

```ts
  1  | import {test,expect,type Page} from "@playwright/test";
  2  | import {AxeBuilder} from "@axe-core/playwright";
  3  | import {writeFile} from "node:fs/promises";
  4  | import {authorized,networkRows,fault,call} from "./fixtures/ui-p03-reference";
  5  | const id="11111111-1111-4111-8111-000000000001";
  6  | async function fill(page:Page,question="P03 bounded reference research"){await expect(page.getByLabel("数据快照",{exact:true}).locator(`option[value="${id}"]`)).toHaveCount(1);await page.getByLabel("数据快照",{exact:true}).selectOption(id);await page.getByLabel("研究问题",{exact:true}).fill(question);await page.getByLabel("截止时间（UTC）",{exact:true}).fill(new Date(Date.now()+3600000).toISOString());await page.getByLabel("我已确认任务不包含交易指令",{exact:true}).check();}
  7  | async function submit(page:Page){await page.getByRole("button",{name:"提交研究",exact:true}).click();await expect(page.getByRole("region",{name:"研究受理回执"})).toBeVisible();}
  8  | test("P03 creates one audited 202, lists actual C03 rows, server filters and immutable cursor pages",async({page})=>{
  9  |  await page.goto("/research/new");await authorized(page);await fill(page);await page.getByRole("button",{name:"提交研究",exact:true}).dblclick();await expect(page.getByRole("region",{name:"研究受理回执"})).toBeVisible();expect(networkRows().filter(r=>r.method==="POST")).toHaveLength(1);const first=networkRows().find(r=>r.accepted)!.accepted as {jobId:string;correlationId:string;auditRef:string};const audit=await call(`/v1/audit/evidence-chains/${first.correlationId}`);expect(audit.status).toBe(200);expect(audit.body.items.some(e=>e.eventId===first.auditRef)).toBe(true);
  10 |  await page.getByRole("button",{name:"填写另一项研究",exact:true}).click();await fill(page,"P03 second independent intent");await submit(page);await page.getByRole("link",{name:"Research 列表",exact:true}).click();await authorized(page);await expect(page.getByRole("table")).toContainText(first.jobId);await page.getByLabel("每页条数",{exact:true}).selectOption("1");await page.getByRole("button",{name:"刷新列表",exact:true}).click();await expect(page.locator("tbody tr")).toHaveCount(1);await page.getByRole("button",{name:"下一页",exact:true}).click();await expect(page.getByRole("button",{name:"下一页",exact:true})).toBeDisabled();const q=networkRows().filter(r=>r.path==="/v1/research-runs"&&r.method==="GET");expect(q.some(r=>r.query?.includes("cursor="))).toBe(true);await page.getByLabel("任务状态",{exact:true}).selectOption("failed");await page.getByRole("button",{name:"刷新列表",exact:true}).click();await expect(page.getByText("当前查询无研究任务。",{exact:true})).toBeVisible();expect(await page.evaluate(()=>[localStorage.length,sessionStorage.length])).toEqual([0,0]);
  11 | });
  12 | test("P03 local form errors focus fields, backend rejection stays inline and hides raw private text",async({page})=>{
  13 |  await page.goto("/research/new");await authorized(page);await expect(page.getByLabel("数据快照",{exact:true}).locator(`option[value="${id}"]`)).toHaveCount(1);await page.getByRole("button",{name:"提交研究",exact:true}).click();await expect(page.getByLabel("数据快照",{exact:true})).toBeFocused();await fill(page);await page.getByLabel("预算（整数成本单位）",{exact:true}).fill("01");await page.getByRole("button",{name:"提交研究",exact:true}).click();await expect(page.getByLabel("预算（整数成本单位）",{exact:true})).toBeFocused();expect(networkRows().filter(r=>r.method==="POST")).toHaveLength(0);await page.getByLabel("预算（整数成本单位）",{exact:true}).fill("10");fault({fieldReject:true});await page.getByRole("button",{name:"提交研究",exact:true}).click();await expect(page.locator("#error-budget")).toContainText("服务端拒绝此字段");await expect(page.getByLabel("预算（整数成本单位）",{exact:true})).toBeFocused();await expect(page.locator("main")).not.toContainText("private SQL");fault({});await submit(page);
  14 | });
  15 | test("P03 lost committed response explicitly retries original idempotency key and creates only one run",async({page})=>{
  16 |  await page.goto("/research/new");await authorized(page);await fill(page);fault({dropCreate:true});await page.getByRole("button",{name:"提交研究",exact:true}).click();await expect(page.getByRole("button",{name:"以原内容重试确认",exact:true})).toBeVisible();await expect(page.getByLabel("研究问题",{exact:true})).toBeDisabled();expect(networkRows().filter(r=>r.method==="POST")).toHaveLength(1);await page.getByRole("button",{name:"以原内容重试确认",exact:true}).click();await expect(page.getByRole("region",{name:"研究受理回执"})).toBeVisible();const writes=networkRows().filter(r=>r.method==="POST");expect(writes).toHaveLength(2);expect(writes[0].keyHash).toBe(writes[1].keyHash);expect(writes[0].bodyHash).toBe(writes[1].bodyHash);expect(writes[0].accepted).toEqual(writes[1].accepted);await page.getByRole("link",{name:"Research 列表",exact:true}).click();await authorized(page);await expect(page.locator("tbody tr")).toHaveCount(1);
  17 | });
  18 | test("P03 snapshot becomes blocked before submission; no C03 command leaves browser",async({page})=>{
  19 |  await page.goto("/research/new");await authorized(page);await fill(page);fault({snapshotQuality:"degraded"});await page.getByRole("button",{name:"提交研究",exact:true}).click();await expect(page.locator("#error-dataSnapshotId")).toContainText("快照质量、许可或时效受限");expect(networkRows().filter(r=>r.method==="POST")).toHaveLength(0);
  20 | });
  21 | test("P03 narrowed authority and offline clear form; explicit recovery never replays",async({page})=>{
  22 |  await page.goto("/research/new");await authorized(page);await fill(page);fault({readonly:true});await page.getByRole("button",{name:"提交研究",exact:true}).click();await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();expect(networkRows().filter(r=>r.method==="POST")).toHaveLength(0);fault({});await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await authorized(page);await expect(page.getByLabel("研究问题",{exact:true})).toHaveValue("");await page.evaluate(()=>window.dispatchEvent(new Event("offline")));await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.getByRole("form")).toHaveCount(0);await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await authorized(page);expect(networkRows().filter(r=>r.method==="POST")).toHaveLength(0);
  23 | });
  24 | test("P03 cursor expiration and rate limit need explicit retry, never auto repeat",async({page})=>{
  25 |  await page.goto("/research");await authorized(page);await expect(page.getByText("当前查询无研究任务。",{exact:true})).toBeVisible();fault({listExpired:true});await page.getByRole("button",{name:"刷新列表",exact:true}).click();await expect(page.locator("main").getByRole("alert")).toContainText("分页已失效");await page.getByRole("button",{name:"刷新列表",exact:true}).click();await expect(page.getByText("当前查询无研究任务。",{exact:true})).toBeVisible();await page.getByRole("link",{name:"新建研究",exact:true}).click();await authorized(page);await fill(page);fault({rateLimited:true});await page.getByRole("button",{name:"提交研究",exact:true}).click();await expect(page.locator("main").getByRole("alert")).toContainText("请求过于频繁");fault({});await expect(page.getByRole("button",{name:"提交研究",exact:true})).toBeEnabled();expect(networkRows().filter(r=>r.method==="POST")).toHaveLength(1);await submit(page);
  26 | });
  27 | test("P03 read-only identity cannot create and checking state reveals no form",async({page})=>{
  28 |  fault({slow:true,readonly:true});await page.goto("/research/new");await expect(page.locator('[data-route-access="checking"]')).toBeVisible();await expect(page.getByRole("form")).toHaveCount(0);await authorized(page);await expect(page.locator("main").getByRole("alert")).toContainText("缺少研究写入");expect(networkRows().filter(r=>r.method==="POST")).toHaveLength(0);
  29 | });
  30 | 
  31 | test("P03 review scope acknowledgment, step navigation and guarded discard keep draft memory only",async({page})=>{
  32 |  await page.goto("/research/new");await authorized(page);await fill(page);await page.getByLabel("我已确认任务不包含交易指令",{exact:true}).uncheck();await page.getByRole("button",{name:"提交研究",exact:true}).click();await expect(page.getByLabel("我已确认任务不包含交易指令",{exact:true})).toBeFocused();expect(networkRows().filter(r=>r.method==="POST")).toHaveLength(0);await page.getByRole("button",{name:/问题与范围/}).click();await expect(page.getByLabel("研究问题",{exact:true})).toBeFocused();await expect(page.getByRole("region",{name:"已选快照摘要",exact:true})).toContainText("非用途批准");await expect(page.locator(".p03-engine-card")).toContainText("健康与版本未提供");await page.getByRole("button",{name:"关闭研究表单",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();await expect(page.getByRole("button",{name:"继续填写",exact:true})).toBeFocused();await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);await expect(page.getByRole("button",{name:"关闭研究表单",exact:true})).toBeFocused();await expect(page.getByLabel("研究问题",{exact:true})).toHaveValue("P03 bounded reference research");await page.getByRole("button",{name:"关闭研究表单",exact:true}).click();await page.getByRole("button",{name:"离开并查看列表",exact:true}).click();await authorized(page);await expect(page.getByRole("form",{name:"研究创建表单",exact:true})).toHaveCount(0);expect(networkRows().filter(r=>r.method==="POST")).toHaveLength(0);expect(await page.evaluate(()=>[localStorage.length,sessionStorage.length])).toEqual([0,0]);
  33 | });
  34 | test("P03 reference search uses server correlation filter; invalid search dispatches no list; page counts stay local",async({page})=>{
  35 |  await page.goto("/research/new");await authorized(page);await fill(page);await submit(page);const receipt=networkRows().find(r=>r.accepted)!.accepted as {correlationId:string};await page.getByRole("link",{name:"Research 列表",exact:true}).click();await authorized(page);await expect(page.locator(".p03-summary")).toContainText("本页全部1");await page.getByLabel("查询引用类型",{exact:true}).selectOption("correlationId");await page.getByLabel("完整研究引用",{exact:true}).fill(receipt.correlationId);await page.getByRole("button",{name:"刷新列表",exact:true}).click();await expect(page.locator("tbody tr")).toHaveCount(1);expect(networkRows().some(r=>r.path==="/v1/research-runs"&&r.query?.includes("correlationId%3Aeq%3A"+receipt.correlationId))).toBe(true);const before=networkRows().filter(r=>r.path==="/v1/research-runs"&&r.method==="GET").length;await page.getByLabel("完整研究引用",{exact:true}).fill("search title is not supported");await page.getByRole("button",{name:"刷新列表",exact:true}).click();await expect(page.locator(".research-message")).toContainText("筛选引用须为完整有效 ID");expect(networkRows().filter(r=>r.path==="/v1/research-runs"&&r.method==="GET")).toHaveLength(before);await page.getByLabel("完整研究引用",{exact:true}).fill("");await page.getByRole("button",{name:"本页失败 0",exact:true}).click();await expect(page.getByText("当前查询无研究任务。",{exact:true})).toBeVisible();await expect(page.locator(".p03-summary")).toContainText("本页全部0");
  36 | });
  37 | for(const theme of ["dark","light"]as const)test(`P03 ${theme} actual list/create workbench, three widths, snapshots and axe`,async({page},info)=>{
  38 |  test.setTimeout(90000);await page.emulateMedia({colorScheme:theme,reducedMotion:"reduce"});await page.setViewportSize({width:1672,height:941});await page.goto("/research/new");await authorized(page);await fill(page);await submit(page);await page.getByRole("button",{name:"填写另一项研究",exact:true}).click();await fill(page,"P03 second actual reference intent");await submit(page);const scans=[];
  39 |  for(const path of ["/research","/research/new"]){await page.goto(path);await authorized(page);if(path.endsWith("new"))await fill(page,"验证可复现的数据快照与研究假设");await expect(page.locator("tbody tr")).toHaveCount(2);
> 40 |  for(const width of [1672,1024,390]){await page.setViewportSize({width,height:width===390?844:941});await page.locator(".p03-main").evaluate(el=>{el.scrollTop=0;});await page.locator(".p03-compose").evaluate(el=>{el.scrollTop=0;});if(width===390&&path.endsWith("new"))await page.locator(".p03-compose").scrollIntoViewIfNeeded();await expect(page.locator(".quantos-theme")).toHaveAttribute("data-quantos-theme",theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const scan=await new AxeBuilder({page}).analyze();scans.push({path,width,violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath("axe.json"),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,theme,scans,priorIconIncomplete:6,priorHeaderIncomplete:2,manualScreenReader:"NOT_RUN",nativeZoom200:"NOT_RUN",crossOsVisual:"NOT_RUN"},null,2));expect(scan.violations).toEqual([]);
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         ^ Error: expect(received).toEqual(expected) // deep equality
  41 |  await expect(page).toHaveScreenshot(`p03-${path.endsWith("new")?"new":"list"}-${theme}-${width}.png`,{maxDiffPixelRatio:.005,mask:[page.locator(".research-table tbody th"),page.locator(".research-table tbody td:nth-child(4)"),page.locator(".research-table tbody td:nth-child(6)"),page.locator(".research-table tbody td:nth-child(7)"),page.locator(".p03-read-at"),page.locator("#research-deadlineAt"),page.locator(".p03-review-time"),page.locator(".p03-snapshot-card dd:nth-of-type(3)")]});await page.screenshot({path:info.outputPath(`p03-${path.endsWith("new")?"new":"list"}-${theme}-${width}.png`)});
  42 |  if(width===390&&path.endsWith("new")){await page.getByRole("button",{name:"提交研究",exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole("button",{name:"提交研究",exact:true})).toBeVisible();await page.screenshot({path:info.outputPath(`p03-new-${theme}-mobile-submit.png`)});}
  43 |  }}await page.getByRole("button",{name:"切换主题",exact:true}).click();await expect(page.locator(".quantos-theme")).toHaveAttribute("data-quantos-theme",theme==="dark"?"light":"dark");
  44 | });
  45 | 
```