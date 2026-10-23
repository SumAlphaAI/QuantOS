# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui302.spec.ts >> missing report and malformed deep links disclose no invented facts or writes
- Location: tests/e2e/ui302.spec.ts:16:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('alert')
Expected substring: "报告不可用"
Error: strict mode violation: getByRole('alert') resolved to 2 elements:
    1) <p role="alert">报告不可用（404）。请核对任务引用、授权或稍后显式刷新。</p> aka getByText('报告不可用（404）。请核对任务引用、授权或稍后显式刷新。')
    2) <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div> aka locator('[id="__next-route-announcer__"]')

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByRole('alert')
    - locator resolved to <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div>
    - unexpected value ""

```

# Test source

```ts
  1  | import {test,expect} from "@playwright/test";
  2  | import AxeBuilder from "@axe-core/playwright";
  3  | import {openLab,authorized,fault,networkRows,installReferenceHooks} from "./fixtures/ui301-reference";
  4  | import {writeFile} from "node:fs/promises";
  5  | installReferenceHooks();
  6  | test("real C05 static check, pinned backtest, report SSE and deep link",async({page},info)=>{
  7  |  await openLab(page,false);await expect(page.getByRole("button",{name:"创建回测",exact:true})).toBeDisabled();await page.getByRole("button",{name:"运行静态检查",exact:true}).click();await expect(page.getByText(/通过 · v/)).toBeVisible();await page.getByRole("button",{name:"创建回测",exact:true}).click();const link=page.getByRole("link",{name:/回测报告 v/}).first();await expect(link).toBeVisible();const href=(await link.getAttribute('href'))!;await link.click();await authorized(page);await expect(page.getByRole('heading',{name:'Backtest Report'})).toBeVisible();await expect(page.getByText(/事件流：complete/)).toBeVisible();for(const key of ['clock','fee_bps','slippage_bps','environment_hash','reportHash'])await expect(page.getByText(key,{exact:true})).toBeVisible();await expect(page.getByText('回测证据完整；Release 与审批仍由 UI-303 接入')).toBeVisible();await expect(page.getByRole('button',{name:'提交发布候选'})).toBeDisabled();const axe=await new AxeBuilder({page}).analyze();await writeFile(info.outputPath('ui302-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,violations:axe.violations,incomplete:axe.incomplete,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));expect(axe.violations).toEqual([]);await page.screenshot({path:info.outputPath('report.png'),fullPage:true});await page.reload();await authorized(page);await expect(page.getByText(/事件流：complete/)).toBeVisible();expect(page.url()).toContain(href);expect(networkRows().filter(r=>r.method==='POST'&&r.path==='/v1/backtests')).toHaveLength(1);
  8  | });
  9  | test("real static failure blocks backtest; repaired saved version can check again",async({page})=>{
  10 |  await openLab(page,false);const editor=page.getByLabel('文件内容',{exact:true}),original=await editor.inputValue();await editor.fill(original+'\nBAD_UNTRUSTED');await expect(page.getByText(/已保存 · objectVersion/)).toBeVisible();await page.getByRole('button',{name:'运行静态检查',exact:true}).click();await expect(page.getByText('未通过，阻断回测')).toBeVisible();await expect(page.getByRole('button',{name:'创建回测',exact:true})).toBeDisabled();expect(networkRows().some(r=>r.status===422&&r.path.endsWith('static-checks'))).toBe(true);await editor.fill(original);await expect(page.getByText(/已保存 · objectVersion/)).toBeVisible();await page.getByRole('button',{name:'运行静态检查',exact:true}).click();await expect(page.getByText(/通过 · v/)).toBeVisible();expect(networkRows().filter(r=>r.path==='/v1/backtests')).toHaveLength(0);
  11 | });
  12 | test("lost committed backtest explicitly replays same key, no duplicate run",async({page})=>{
  13 |  await openLab(page,false);await page.getByRole('button',{name:'运行静态检查',exact:true}).click();await expect(page.getByText(/通过 · v/)).toBeVisible();fault({drop:true});await page.getByRole('button',{name:'创建回测',exact:true}).click();await expect(page.getByRole('button',{name:'重试原回测请求'})).toBeVisible();await expect(page.getByLabel('文件内容',{exact:true})).toBeDisabled();await page.getByRole('button',{name:'重试原回测请求'}).click();await expect(page.getByRole('link',{name:/回测报告 v/})).toHaveCount(1);const writes=networkRows().filter(r=>r.method==='POST'&&r.path==='/v1/backtests');expect(writes).toHaveLength(2);expect(writes[0].keyHash).toBe(writes[1].keyHash);expect(writes[0].bodyHash).toBe(writes[1].bodyHash);expect(writes[0].responseHash).toBe(writes[1].responseHash);
  14 | });
  15 | test("approver reads Lab but cannot check or create backtest",async({page})=>{fault({readonly:true});await openLab(page,false);await expect(page.getByRole('button',{name:'运行静态检查',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'创建回测',exact:true})).toBeDisabled();expect(networkRows().some(r=>r.method==='POST')).toBe(false);});
> 16 | test("missing report and malformed deep links disclose no invented facts or writes",async({page})=>{await page.goto('/backtests/aaaaaaaa-1111-4111-8111-111111111111');await authorized(page);await expect(page.getByRole('alert')).toContainText('报告不可用');await expect(page.getByRole('heading',{name:'Metrics',exact:true})).toHaveCount(0);expect(networkRows().some(r=>r.method!=='GET')).toBe(false);const response=await page.goto('/backtests/not-a-uuid');expect(response?.status()).toBe(404);});
     |                                                                                                                                                                                                                                     ^ Error: expect(locator).toContainText(expected) failed
  17 | 
```