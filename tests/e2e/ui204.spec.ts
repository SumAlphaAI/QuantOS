import {test,expect} from "@playwright/test";
import {networkRows,fault} from "./fixtures/ui204-reference";
const id="11111111-1111-4111-8111-000000000001",failed="11111111-1111-4111-8111-000000000002";
test("C04 actual reference catalog, server paging, detail and conservative purpose checks",async({page})=>{
 await page.goto("/data-snapshots");await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();await expect(page.getByRole("button",{name:id,exact:true})).toBeVisible();
 await page.getByRole("button",{name:id,exact:true}).click();await expect(page.locator('[data-snapshot-eligible="true"]')).toBeVisible();await expect(page.getByRole("link",{name:"快照永久引用"})).toHaveAttribute("href","/data-snapshots/"+id);await page.getByRole("button",{name:"核对策略用途"}).click();await expect(page.getByRole("status")).toContainText("不授予策略/交易用途");
 await page.getByLabel("每页",{exact:true}).fill("1");await page.getByLabel("排序",{exact:true}).selectOption("snapshotId:asc");await page.getByRole("button",{name:"刷新目录",exact:true}).click();
 const latest=()=>networkRows().filter(r=>r.path==="/v1/data-snapshots").at(-1)?.snapshotIds;
 await expect.poll(()=>latest()?.length).toBe(1);const first=latest()![0];await expect(page.getByRole("button",{name:first,exact:true})).toBeVisible();await page.getByRole("button",{name:"下一页",exact:true}).click();await expect.poll(()=>latest()?.[0]).not.toBe(first);await expect.poll(()=>latest()?.length).toBe(1);await expect(page.getByRole("button",{name:latest()![0],exact:true})).toBeVisible();
 await page.getByLabel("快照 ID",{exact:true}).fill(failed);await page.getByRole("button",{name:"刷新目录",exact:true}).click();await page.getByRole("button",{name:failed,exact:true}).click();await expect(page.locator('[data-snapshot-eligible="false"]')).toContainText("质量失败");await expect(page.getByRole("button",{name:"核对策略用途"})).toBeDisabled();await expect(page.getByRole("button",{name:"核对交易用途"})).toBeDisabled();
 expect(networkRows().some(r=>r.path==="/v1/data-snapshots"&&r.query?.includes("cursor="))).toBe(true);expect(networkRows().every(r=>r.method==="GET")).toBe(true);
 await page.screenshot({path:test.info().outputPath("ui204-catalog-detail.png"),fullPage:true});
});
test("canonical and legacy details load through host aliases; license missing blocks use",async({page})=>{
 await page.goto("/data-snapshots/"+id);await expect(page.locator('[data-snapshot-eligible="true"]')).toBeVisible();await page.goto("/data-snapshots?snapshotId=11111111-1111-4111-8111-000000000003");await expect(page.locator('[data-snapshot-eligible="false"]')).toContainText("缺少许可");
});
test("offline clears facts and requires explicit authorized recovery",async({page,context})=>{
 await page.goto("/data-snapshots/"+id);await expect(page.locator('[data-snapshot-eligible="true"]')).toBeVisible();await context.setOffline(true);await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.getByText(id,{exact:true})).toHaveCount(0);await context.setOffline(false);await page.getByRole("button",{name:"重新验证访问条件"}).click();await expect(page.locator('[data-snapshot-eligible="true"]')).toBeVisible();
});
test("capability narrowing refuses snapshot HTTP and ambiguous references dispatch nothing",async({page})=>{
 fault({readonly:true});await page.goto("/data-snapshots");await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();expect(networkRows().some(r=>r.path.includes("data-snapshots"))).toBe(false);
 fault({});await page.goto("/data-snapshots/"+id+"?snapshotId=11111111-1111-4111-8111-000000000002");await expect(page.getByRole("heading",{name:"快照引用无效"})).toBeVisible();expect(networkRows().some(r=>r.path.includes("data-snapshots"))).toBe(false);
});
test("filtered empty page, mobile layout and slow identity publish no early facts",async({page})=>{
 fault({slow:true});await page.setViewportSize({width:390,height:844});await page.goto("/data-snapshots");await expect(page.locator('[data-route-access="checking"]')).toBeVisible();expect(networkRows().some(r=>r.path.includes("data-snapshots"))).toBe(false);await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();await page.getByLabel("质量",{exact:true}).selectOption("degraded");await page.getByRole("button",{name:"刷新目录",exact:true}).click();await expect(page.getByText("当前查询无快照。",{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:test.info().outputPath("ui204-mobile-empty.png"),fullPage:true});
});

test("synthetic degraded/expired narrowing blocks both uses; 503 has explicit read recovery",async({page})=>{
 for(const quality of ["degraded","expired"] as const){fault({snapshotQuality:quality});await page.goto("/data-snapshots/"+id);await expect(page.locator('[data-snapshot-eligible="false"]')).toBeVisible();await expect(page.getByRole("button",{name:"核对策略用途"})).toBeDisabled();await expect(page.getByRole("button",{name:"核对交易用途"})).toBeDisabled();}
 fault({auditFailures:1});await page.goto("/data-snapshots");await expect(page.locator(".snapshot-workspace").getByRole("alert")).toContainText("暂不可用");const count=networkRows().filter(r=>r.path==="/v1/data-snapshots").length;await page.waitForTimeout(300);expect(networkRows().filter(r=>r.path==="/v1/data-snapshots")).toHaveLength(count);await page.getByRole("button",{name:"刷新目录",exact:true}).click();await expect(page.getByRole("button",{name:id,exact:true})).toBeVisible();
});
