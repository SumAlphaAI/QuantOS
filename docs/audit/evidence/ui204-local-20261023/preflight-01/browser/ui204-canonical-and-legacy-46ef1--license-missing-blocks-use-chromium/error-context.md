# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui204.spec.ts >> canonical and legacy details load through host aliases; license missing blocks use
- Location: tests/e2e/ui204.spec.ts:12:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-snapshot-eligible="true"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('[data-snapshot-eligible="true"]')

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
  5  |  await page.goto("/data-snapshots");await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();await expect(page.getByRole("button",{name:id,exact:true})).toBeVisible();
  6  |  await page.getByLabel("每页",{exact:true}).fill("1");await page.getByLabel("排序",{exact:true}).selectOption("snapshotId:asc");await page.getByRole("button",{name:"刷新目录",exact:true}).click();await expect(page.getByRole("button",{name:"下一页",exact:true})).toBeEnabled();
  7  |  await page.getByRole("button",{name:id,exact:true}).click();await expect(page.locator('[data-snapshot-eligible="true"]')).toBeVisible();await expect(page.getByRole("link",{name:"快照永久引用"})).toHaveAttribute("href","/data-snapshots/"+id);
  8  |  await page.getByRole("button",{name:"下一页",exact:true}).click();await expect(page.getByRole("button",{name:failed,exact:true})).toBeVisible();await page.getByRole("button",{name:failed,exact:true}).click();await expect(page.locator('[data-snapshot-eligible="false"]')).toContainText("质量失败");await expect(page.getByRole("button",{name:"核对策略用途"})).toBeDisabled();await expect(page.getByRole("button",{name:"核对交易用途"})).toBeDisabled();
  9  |  expect(networkRows().some(r=>r.path==="/v1/data-snapshots"&&r.query?.includes("cursor="))).toBe(true);expect(networkRows().every(r=>r.method==="GET")).toBe(true);
  10 |  await page.screenshot({path:test.info().outputPath("ui204-catalog-detail.png"),fullPage:true});
  11 | });
  12 | test("canonical and legacy details load through host aliases; license missing blocks use",async({page})=>{
> 13 |  await page.goto("/data-snapshots/"+id);await expect(page.locator('[data-snapshot-eligible="true"]')).toBeVisible();await page.goto("/data-snapshots?snapshotId=11111111-1111-4111-8111-000000000003");await expect(page.locator('[data-snapshot-eligible="false"]')).toContainText("缺少许可");
     |                                                                                                       ^ Error: expect(locator).toBeVisible() failed
  14 | });
  15 | test("offline clears facts and requires explicit authorized recovery",async({page,context})=>{
  16 |  await page.goto("/data-snapshots/"+id);await expect(page.locator('[data-snapshot-eligible="true"]')).toBeVisible();await context.setOffline(true);await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.getByText(id,{exact:true})).toHaveCount(0);await context.setOffline(false);await page.getByRole("button",{name:"重新验证访问条件"}).click();await expect(page.locator('[data-snapshot-eligible="true"]')).toBeVisible();
  17 | });
  18 | test("capability narrowing refuses snapshot HTTP and ambiguous references dispatch nothing",async({page})=>{
  19 |  fault({readonly:true});await page.goto("/data-snapshots");await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();expect(networkRows().some(r=>r.path.includes("data-snapshots"))).toBe(false);
  20 |  fault({});await page.goto("/data-snapshots/"+id+"?snapshotId=11111111-1111-4111-8111-000000000002");await expect(page.getByRole("heading",{name:"快照引用无效"})).toBeVisible();expect(networkRows().some(r=>r.path.includes("data-snapshots"))).toBe(false);
  21 | });
  22 | test("filtered empty page, mobile layout and slow identity publish no early facts",async({page})=>{
  23 |  fault({slow:true});await page.setViewportSize({width:390,height:844});await page.goto("/data-snapshots");await expect(page.locator('[data-route-access="checking"]')).toBeVisible();expect(networkRows().some(r=>r.path.includes("data-snapshots"))).toBe(false);await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();await page.getByLabel("质量",{exact:true}).selectOption("degraded");await page.getByRole("button",{name:"刷新目录",exact:true}).click();await expect(page.getByText("当前查询无快照。",{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:test.info().outputPath("ui204-mobile-empty.png"),fullPage:true});
  24 | });
  25 | 
```