# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui506.spec.ts >> UI506 dark light responsive ledger keyboard and axe
- Location: tests/e2e/ui506.spec.ts:18:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import {writeFile} from 'node:fs/promises';
  4  | import {installReferenceHooks,authorized,networkRows,fault,control} from './fixtures/ui506-reference';
  5  | installReferenceHooks();
  6  | const facts=(p:Page)=>p.getByRole('region',{name:'对账运行事实',exact:true}),writes=()=>networkRows().filter(r=>r.method==='POST'&&!r.control);
  7  | async function open(p:Page){const c=await control('/v1/context'),a=c.body.accountId;const q=await control('/v1/reconciliation/runs?accountId='+a);const rows=q.body.items as {runId:string;result:string}[];const id=rows.find(r=>r.result==='differences')!.runId;await p.goto('/reconciliation/'+id);await authorized(p);await expect(facts(p)).toContainText(id);return id;}
  8  | async function rerun(p:Page){await p.getByLabel('重跑理由',{exact:true}).fill('investigate immutable source books');await p.getByRole('button',{name:'请求重跑',exact:true}).click();const d=p.getByRole('dialog');await d.getByLabel('输入“RERUN RECONCILIATION”以确认').fill('RERUN RECONCILIATION');await d.getByRole('button',{name:'确认重跑请求',exact:true}).click();}
  9  | test('UI506 actual X05 immutable ledger rerun stream and Audit chain',async({page})=>{const original=await open(page);await expect(page.getByRole('region',{name:'只读资金账本',exact:true})).toContainText('actual');await expect(page.getByRole('region',{name:'账本差异',exact:true})).toContainText('open');await page.getByRole('button',{name:'核对关联 Performance Alert Audit',exact:true}).click();await expect(page.getByTestId('recon-alerts')).toBeVisible();await rerun(page);await expect(page.getByRole('region',{name:'重跑受理回执',exact:true})).toBeVisible();await expect(facts(page).locator('dd').first()).not.toHaveText(original);await expect(facts(page)).toContainText('暂定结果');await page.getByRole('button',{name:'核对关联 Performance Alert Audit',exact:true}).click();await expect(page.getByTestId('recon-chain')).toContainText('true');expect(writes()).toHaveLength(1);expect(writes()[0].path).toBe('/v1/reconciliation/runs/'+original+'/reruns');await page.getByRole('button',{name:'续传并核对运行',exact:true}).click();await expect.poll(()=>networkRows().some(r=>r.path.endsWith('/stream')&&r.path.includes('/reconciliation/')&&Number(r.query.afterSequence)>0)).toBe(true);});
  10 | test('UI506 lost committed response recovers original key body and version exactly once',async({page})=>{await open(page);fault({drop:true});await rerun(page);await expect(page.getByRole('region',{name:'未知结果',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'请求重跑',exact:true})).toBeDisabled();expect(writes()).toHaveLength(1);await page.getByRole('button',{name:'恢复原请求',exact:true}).click();await expect(page.getByRole('region',{name:'未知结果',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'重跑受理回执',exact:true})).toBeVisible();expect(writes()).toHaveLength(2);expect(writes()[0].keyHash).toBe(writes()[1].keyHash);expect(writes()[0].bodyHash).toBe(writes()[1].bodyHash);expect(writes()[0].version).toBe(writes()[1].version);});
  11 | test('UI506 journal gap stops new reruns then explicit full read recovers',async({page})=>{await open(page);fault({gap:true});await page.getByRole('button',{name:'续传并核对运行',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(facts(page)).toContainText('核对陈旧');await expect(page.getByRole('button',{name:'请求重跑',exact:true})).toBeDisabled();fault({});await page.getByRole('button',{name:'重读完整差异与账本',exact:true}).click();await expect(facts(page)).toContainText('当前事实已核对');expect(writes()).toHaveLength(0);});
  12 | test('UI506 scope mismatch never publishes foreign ledger or run',async({page})=>{fault({foreign:true});await page.goto('/reconciliation');await authorized(page);await expect(page.getByRole('alert')).toBeVisible();await expect(facts(page)).toHaveCount(0);expect(writes()).toHaveLength(0);});
  13 | test('UI506 expired source read-only never enables rerun',async({page})=>{fault({expired:true});await open(page);await expect(facts(page)).toContainText('核对陈旧');await page.getByLabel('重跑理由',{exact:true}).fill('expired');await expect(page.getByRole('button',{name:'请求重跑',exact:true})).toBeDisabled();expect(writes()).toHaveLength(0);});
  14 | test('UI506 409 does not invent a run or automatically retry',async({page})=>{await open(page);fault({conflict:true});await rerun(page);await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('region',{name:'重跑受理回执',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'未知结果',exact:true})).toHaveCount(0);expect(writes()).toHaveLength(1);});
  15 | test('UI506 empty loading and 429 sanitized explicit retry',async({page})=>{fault({empty:true,slow:true});await page.goto('/reconciliation');await authorized(page);await expect(page.getByText('正在读取对账事实…',{exact:true})).toBeVisible();await expect(page.getByText('当前授权及筛选的运行页为空。',{exact:true})).toBeVisible();fault({rateLimit:true});await page.getByRole('button',{name:'刷新运行列表',exact:true}).click();await expect(page.getByRole('alert')).toContainText('冷却');await expect(page.getByRole('button',{name:'刷新运行列表',exact:true})).toBeDisabled();await expect(page.getByText('private SQL',{exact:false})).toHaveCount(0);expect(writes()).toHaveLength(0);});
  16 | test('UI506 viewer injected scope unknown route refused',async({page})=>{fault({readonly:true});await page.goto('/reconciliation');await expect(page.locator('[data-route-access="denied"]')).toBeVisible();expect(networkRows().some(r=>r.path==='/v1/reconciliation/runs')).toBe(false);fault({});const count=networkRows().length;await page.goto('/reconciliation?accountId=evil');await expect(page.getByRole('heading',{name:'Reconciliation 引用无效',exact:true})).toBeVisible();expect(networkRows()).toHaveLength(count);expect((await page.goto('/reconciliation/nope'))?.status()).toBe(404);});
  17 | test('UI506 offline and actual logout clear facts and recovery',async({page,context})=>{await open(page);await context.setOffline(true);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await expect(facts(page)).toHaveCount(0);await context.setOffline(false);await page.reload();await authorized(page);await expect(facts(page)).toBeVisible();expect((await control('/v1/auth/logout',undefined,undefined,{method:'POST'})).status).toBe(204);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await expect(facts(page)).toHaveCount(0);expect(writes()).toHaveLength(0);});
> 18 | test('UI506 dark light responsive ledger keyboard and axe',async({page},info)=>{await open(page);const scans=[];for(const theme of ['dark','light']as const){await page.emulateMedia({colorScheme:theme});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const scan=await new AxeBuilder({page}).analyze();scans.push({theme,width,violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath('ui506-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));expect(scan.violations).toEqual([]);await page.screenshot({path:info.outputPath(`reconciliation-${theme}-${width}.png`),fullPage:true});}}const table=page.getByRole('region',{name:'账本表',exact:true});await table.scrollIntoViewIfNeeded();await table.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>table.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);expect(writes()).toHaveLength(0);});
     |                                                                                                                                                                                                                                                                                                                                                                            ^ Error: expect(received).toBe(expected) // Object.is equality
  19 | 
```