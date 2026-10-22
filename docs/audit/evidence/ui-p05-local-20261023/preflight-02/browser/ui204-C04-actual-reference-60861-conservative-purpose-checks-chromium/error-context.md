# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui204.spec.ts >> C04 actual reference catalog, server paging, detail and conservative purpose checks
- Location: tests/e2e/ui204.spec.ts:4:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-route-access="authorized"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('[data-route-access="authorized"]')

```

```yaml
- main:
  - heading "访问条件已变化" [level=1]
  - paragraph: 已清除目录、详情与用途检查结果；不会自动恢复操作。
  - button "重新验证访问条件"
  - link "返回 Command":
    - /url: /command
- alert
```

# Test source

```ts
  1  | import {test,expect} from "@playwright/test";
  2  | import {networkRows,fault} from "./fixtures/ui204-reference";
  3  | const id="11111111-1111-4111-8111-000000000001",failed="11111111-1111-4111-8111-000000000002";
  4  | test("C04 actual reference catalog, server paging, detail and conservative purpose checks",async({page})=>{
> 5  |  await page.goto("/data-snapshots");await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();await expect(page.getByRole("button",{name:id,exact:true})).toBeVisible();
     |                                                                                                    ^ Error: expect(locator).toBeVisible() failed
  6  |  await page.getByRole("button",{name:id,exact:true}).click();await expect(page.locator('[data-snapshot-eligible="true"]')).toBeVisible();await expect(page.getByRole("link",{name:"快照永久引用"})).toHaveAttribute("href","/data-snapshots/"+id);await page.getByRole("button",{name:"核对策略用途"}).click();await expect(page.getByRole("status")).toContainText("不授予策略/交易用途");
  7  |  await page.getByLabel("每页",{exact:true}).fill("1");await page.getByLabel("排序",{exact:true}).selectOption("snapshotId:asc");await page.getByRole("button",{name:"刷新目录",exact:true}).click();
  8  |  const latest=()=>networkRows().filter(r=>r.path==="/v1/data-snapshots").at(-1)?.snapshotIds;
  9  |  await expect.poll(()=>latest()?.length).toBe(1);const first=latest()![0];await expect(page.getByRole("button",{name:first,exact:true})).toBeVisible();await page.getByRole("button",{name:"下一页",exact:true}).click();await expect.poll(()=>latest()?.[0]).not.toBe(first);await expect.poll(()=>latest()?.length).toBe(1);await expect(page.getByRole("button",{name:latest()![0],exact:true})).toBeVisible();
  10 |  await page.getByLabel("快照 ID",{exact:true}).fill(failed);await page.getByRole("button",{name:"刷新目录",exact:true}).click();await page.getByRole("button",{name:failed,exact:true}).click();await expect(page.locator('[data-snapshot-eligible="false"]')).toContainText("质量失败");await expect(page.getByRole("button",{name:"核对策略用途"})).toBeDisabled();await expect(page.getByRole("button",{name:"核对交易用途"})).toBeDisabled();
  11 |  expect(networkRows().some(r=>r.path==="/v1/data-snapshots"&&r.query?.includes("cursor="))).toBe(true);expect(networkRows().every(r=>r.method==="GET")).toBe(true);
  12 |  await page.screenshot({path:test.info().outputPath("ui204-catalog-detail.png"),fullPage:true});
  13 | });
  14 | test("canonical and legacy details load through host aliases; license missing blocks use",async({page})=>{
  15 |  await page.goto("/data-snapshots/"+id);await expect(page.locator('[data-snapshot-eligible="true"]')).toBeVisible();await page.goto("/data-snapshots?snapshotId=11111111-1111-4111-8111-000000000003");await expect(page.locator('[data-snapshot-eligible="false"]')).toContainText("缺少许可");
  16 | });
  17 | test("offline clears facts and requires explicit authorized recovery",async({page,context})=>{
  18 |  await page.goto("/data-snapshots/"+id);await expect(page.locator('[data-snapshot-eligible="true"]')).toBeVisible();await context.setOffline(true);await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.getByText(id,{exact:true})).toHaveCount(0);await context.setOffline(false);await page.getByRole("button",{name:"重新验证访问条件"}).click();await expect(page.locator('[data-snapshot-eligible="true"]')).toBeVisible();
  19 | });
  20 | test("capability narrowing refuses snapshot HTTP and ambiguous references dispatch nothing",async({page})=>{
  21 |  fault({readonly:true});await page.goto("/data-snapshots");await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();expect(networkRows().some(r=>r.path.includes("data-snapshots"))).toBe(false);
  22 |  fault({});await page.goto("/data-snapshots/"+id+"?snapshotId=11111111-1111-4111-8111-000000000002");await expect(page.getByRole("heading",{name:"快照引用无效"})).toBeVisible();expect(networkRows().some(r=>r.path.includes("data-snapshots"))).toBe(false);
  23 | });
  24 | test("filtered empty page, mobile layout and slow identity publish no early facts",async({page})=>{
  25 |  fault({slow:true});await page.setViewportSize({width:390,height:844});await page.goto("/data-snapshots");await expect(page.locator('[data-route-access="checking"]')).toBeVisible();expect(networkRows().some(r=>r.path.includes("data-snapshots"))).toBe(false);await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();await page.getByLabel("质量",{exact:true}).selectOption("degraded");await page.getByRole("button",{name:"刷新目录",exact:true}).click();await expect(page.getByText("当前查询无快照。",{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:test.info().outputPath("ui204-mobile-empty.png"),fullPage:true});
  26 | });
  27 | 
  28 | test("synthetic degraded/expired narrowing blocks both uses; 503 has explicit read recovery",async({page})=>{
  29 |  for(const quality of ["degraded","expired"] as const){fault({snapshotQuality:quality});await page.goto("/data-snapshots/"+id);await expect(page.locator('[data-snapshot-eligible="false"]')).toBeVisible();await expect(page.getByRole("button",{name:"核对策略用途"})).toBeDisabled();await expect(page.getByRole("button",{name:"核对交易用途"})).toBeDisabled();}
  30 |  fault({auditFailures:1});await page.goto("/data-snapshots");await expect(page.locator(".snapshot-workspace").getByRole("alert")).toContainText("暂不可用");const count=networkRows().filter(r=>r.path==="/v1/data-snapshots").length;await page.waitForTimeout(300);expect(networkRows().filter(r=>r.path==="/v1/data-snapshots")).toHaveLength(count);await page.getByRole("button",{name:"刷新目录",exact:true}).click();await expect(page.getByRole("button",{name:id,exact:true})).toBeVisible();
  31 | });
  32 | 
```