# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p07.spec.ts >> P07 dark actual report, catalog and immutable drawer responsive visual matrix
- Location: tests/e2e/ui-p07.spec.ts:10:50

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  8216 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: p07-report-dark-1672.png

Call log:
  - Expect "toHaveScreenshot(p07-report-dark-1672.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 8216 pixels (ratio 0.01 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 8216 pixels (ratio 0.01 of all image pixels) are different.

```

# Test source

```ts
  1  | import {test,expect,type Page} from "@playwright/test";
  2  | import AxeBuilder from "@axe-core/playwright";
  3  | import {writeFile} from "node:fs/promises";
  4  | import {openLab,authorized,control,networkRows,installReferenceHooks} from "./fixtures/ui301-reference";
  5  | installReferenceHooks();
  6  | async function report(page:Page){await openLab(page,false);await page.getByRole('button',{name:'运行静态检查',exact:true}).click();await expect(page.getByText(/通过 · v/)).toBeVisible();await page.getByRole('button',{name:'创建回测',exact:true}).click();await page.getByRole('link',{name:/回测报告 v/}).first().click();await authorized(page);await expect(page.getByRole('button',{name:'创建不可变 Release',exact:true})).toBeEnabled();return new URL(page.url()).pathname;}
  7  | test('P07 report keyboard tabs, real fill pagination, exact costs and local catalog search',async({page})=>{
  8  |  await report(page);await page.context().grantPermissions(['clipboard-read','clipboard-write']);const raw=JSON.parse((await page.getByTestId('raw-backtest-report').textContent())!);await page.getByRole('button',{name:'复制 reportHash',exact:true}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(raw.reportHash);await expect(page.getByText('净值 / 基准 / 回撤时序未由报告提供。以下仅展示费用与滑点累计值。',{exact:true})).toBeVisible();await page.getByRole('tab',{name:'概览',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'成交',exact:true})).toBeFocused();await expect(page.getByRole('region',{name:'成交明细',exact:true}).locator('tbody tr')).toHaveCount(8);await page.getByRole('button',{name:'下一组成交',exact:true}).click();await expect(page.getByRole('region',{name:'成交明细',exact:true}).locator('tbody tr')).toHaveCount(raw.report.fills.length-8);await page.getByRole('tab',{name:'成本',exact:true}).click();await expect(page.getByRole('tabpanel')).toContainText(raw.metrics.net_pnl);await page.getByRole('tab',{name:'成本',exact:true}).focus();await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'验证',exact:true})).toBeFocused();await expect(page.getByRole('tabpanel')).toContainText('泄漏检查决策');await page.getByRole('button',{name:'创建不可变 Release',exact:true}).click();await page.getByRole('link',{name:'查看 Release 详情',exact:true}).click();await authorized(page);await expect(page.getByTestId('raw-release')).toBeAttached();await page.goto('/releases');await authorized(page);await expect(page.getByRole('region',{name:'Release 列表',exact:true}).locator('tbody tr')).toHaveCount(1);await page.getByLabel('搜索本页候选',{exact:true}).fill('missing');await expect(page.getByText('本页没有匹配的候选。',{exact:true})).toBeVisible();expect(networkRows().some(r=>r.path==='/v1/commands')).toBe(false);
  9  | });
  10 | for(const theme of ['dark','light'] as const)test(`P07 ${theme} actual report, catalog and immutable drawer responsive visual matrix`,async({page},info)=>{
  11 |  await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});const reportPath=await report(page);await page.getByRole('button',{name:'创建不可变 Release',exact:true}).click();const link=page.getByRole('link',{name:'查看 Release 详情',exact:true});await expect(link).toBeVisible();const releasePath=(await link.getAttribute('href'))!;await link.click();await authorized(page);await page.getByRole('button',{name:'提交审批申请',exact:true}).click();await expect(page.getByText(/服务端状态：pending/)).toBeVisible();const pending=JSON.parse((await page.getByTestId('raw-release').textContent())!),opts={method:'POST' as const,session:'session-approver' as const},mfa=await control('/v1/auth/mfa/challenges',{purpose:'security_change',code:'123456'},undefined,opts);expect(mfa.status).toBe(200);const step=await control('/v1/auth/reauth',{challengeRef:mfa.body.challengeRef},undefined,opts);expect(step.status).toBe(200);expect((await control(`/v1/approvals/${pending.approvalRef}/decisions`,{decision:'approve',mfaChallengeRef:mfa.body.challengeRef,reauthTokenRef:step.body.reauthTokenRef},'0',opts)).status).toBe(200);const scans=[];
  12 |  for(const [name,path] of [['report',reportPath],['catalog','/releases'],['release',releasePath]]){
  13 |   await page.goto(path);await authorized(page);if(name==='report')await expect(page.getByRole('button',{name:'创建不可变 Release',exact:true})).toBeEnabled();else if(name==='release'){await expect(page.getByTestId('raw-release')).toBeAttached();await expect(page.getByText(/服务端状态：approved/)).toBeVisible();}else await expect(page.getByRole('region',{name:'Release 列表',exact:true}).locator('tbody tr')).toHaveCount(1);
  14 |   for(const width of [1672,1024,390]){
> 15 |    await page.setViewportSize({width,height:width===390?844:941});await page.locator('.p07-main').evaluate(el=>el.scrollTo(0,0));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const scan=await new AxeBuilder({page}).analyze();scans.push({theme,name,width,violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath('p07-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN',crossOSVisual:'NOT_RUN'},null,2));expect(scan.violations).toEqual([]);await page.screenshot({path:info.outputPath(`p07-${name}-${theme}-${width}.png`),fullPage:true});await expect(page).toHaveScreenshot(`p07-${name}-${theme}-${width}.png`,{animations:'disabled',maxDiffPixelRatio:.005,mask:[page.locator('.p07-volatile')]});if(name==='release'){await page.getByLabel('目标选择',{exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('heading',{name:'审批与审计',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath(`p07-release-targets-${theme}-${width}.png`),fullPage:true});}
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               ^ Error: expect(page).toHaveScreenshot(expected) failed
  16 |   }
  17 |  }
  18 |  await page.getByRole('button',{name:'切换主题',exact:true}).click();await expect(page.locator('.quantos-theme')).toHaveAttribute('data-quantos-theme',theme==='dark'?'light':'dark');
  19 | });
  20 | 
```