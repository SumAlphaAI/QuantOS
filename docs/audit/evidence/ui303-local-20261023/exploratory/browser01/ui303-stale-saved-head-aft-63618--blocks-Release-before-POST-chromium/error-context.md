# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui303.spec.ts >> stale saved head after reviewed report blocks Release before POST
- Location: tests/e2e/ui303.spec.ts:15:5

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator:  getByRole('button', { name: '创建不可变 Release', exact: true })
Expected: enabled
Received: disabled
Timeout:  5000ms

Call log:
  - Expect "toBeEnabled" with timeout 5000ms
  - waiting for getByRole('button', { name: '创建不可变 Release', exact: true })
    14 × locator resolved to <button disabled>创建不可变 Release</button>
       - unexpected value "disabled"

```

```yaml
- button "创建不可变 Release" [disabled]
```

# Test source

```ts
  1  | import {test,expect,type Page} from "@playwright/test";
  2  | import AxeBuilder from "@axe-core/playwright";
  3  | import {writeFile} from "node:fs/promises";
  4  | import {openLab,authorized,fault,networkRows,control,installReferenceHooks} from "./fixtures/ui301-reference";
  5  | installReferenceHooks();
> 6  | async function report(page:Page){await openLab(page,false);await page.getByRole('button',{name:'运行静态检查',exact:true}).click();await expect(page.getByText(/通过 · v/)).toBeVisible();await page.getByRole('button',{name:'创建回测',exact:true}).click();await page.getByRole('link',{name:/回测报告 v/}).first().click();await authorized(page);await expect(page.getByRole('button',{name:'创建不可变 Release',exact:true})).toBeEnabled();}
     |                                                                                                                                                                                                                                                                                                                                                                                                                ^ Error: expect(locator).toBeEnabled() failed
  7  | async function release(page:Page){await report(page);await page.getByRole('button',{name:'创建不可变 Release',exact:true}).click();const link=page.getByRole('link',{name:'查看 Release 详情',exact:true});await expect(link).toBeVisible();const href=(await link.getAttribute('href'))!;await link.click();await authorized(page);await expect(page.getByTestId('raw-release')).toBeAttached();return href;}
  8  | async function approve(approvalId:string){const opts={method:'POST' as const,session:'session-approver' as const};const mfa=await control('/v1/auth/mfa/challenges',{purpose:'security_change',code:'123456'},undefined,opts);expect(mfa.status).toBe(200);const step=await control('/v1/auth/reauth',{challengeRef:mfa.body.challengeRef},undefined,opts);expect(step.status).toBe(200);const decision=await control(`/v1/approvals/${approvalId}/decisions`,{decision:'approve',mfaChallengeRef:mfa.body.challengeRef,reauthTokenRef:step.body.reauthTokenRef},'0',opts);expect(decision.status).toBe(200);}
  9  | test('actual immutable Release, submission C08 and approved backend target selection',async({page},info)=>{
  10 |  const href=await release(page),before=JSON.parse((await page.getByTestId('raw-release').textContent())!);await expect(page.getByLabel('目标选择',{exact:true})).toBeDisabled();await page.getByRole('button',{name:'提交审批申请',exact:true}).click();await expect(page.getByText(/服务端状态：pending/)).toBeVisible();await expect(page.getByLabel('目标选择',{exact:true})).toBeDisabled();const pending=JSON.parse((await page.getByTestId('raw-release').textContent())!);expect(pending.contentHash).toBe(before.contentHash);expect(pending.parameters).toEqual(before.parameters);expect(pending.evidenceRefs).toEqual(before.evidenceRefs);await writeFile(info.outputPath('release-pending.json'),JSON.stringify(pending,null,2));await approve(pending.approvalRef);await page.getByRole('button',{name:'刷新 Release 与审批',exact:true}).click();await expect(page.getByText(/服务端状态：approved/)).toBeVisible();const select=page.getByLabel('目标选择',{exact:true});await expect(select).toBeEnabled();const approved=JSON.parse((await page.getByTestId('raw-release').textContent())!);expect(approved.contentHash).toBe(before.contentHash);expect(await select.locator('option').evaluateAll(nodes=>nodes.slice(1).map(n=>(n as HTMLOptionElement).value))).toEqual(approved.allowedTargets);await select.selectOption('shadow');await expect(page.getByText('已选择目标：shadow',{exact:true})).toBeVisible();await writeFile(info.outputPath('release-approved.json'),JSON.stringify(approved,null,2));const scans=[];for(const width of [1440,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const result=await new AxeBuilder({page}).analyze();scans.push({width,violations:result.violations,incomplete:result.incomplete});expect(result.violations).toEqual([]);await page.screenshot({path:info.outputPath(`release-${width}.png`),fullPage:true});}await writeFile(info.outputPath('ui303-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));await page.reload();await authorized(page);await expect(page.getByText(/服务端状态：approved/)).toBeVisible();expect(page.url()).toContain(href);expect(networkRows().filter(r=>!r.control&&r.method==='POST').map(r=>r.path)).not.toContain('/v1/commands');
  11 | });
  12 | test('lost create and lost submission reuse original keys, versions and intent',async({page})=>{
  13 |  await report(page);fault({drop:true});await page.getByRole('button',{name:'创建不可变 Release',exact:true}).click();await expect(page.getByRole('button',{name:'重试原 Release 请求',exact:true})).toBeEnabled();await page.getByRole('button',{name:'重试原 Release 请求',exact:true}).click();await page.getByRole('link',{name:'查看 Release 详情',exact:true}).click();await authorized(page);fault({drop:true});await page.getByRole('button',{name:'提交审批申请',exact:true}).click();await expect(page.getByRole('button',{name:'重试原审批申请',exact:true})).toBeEnabled();await page.getByRole('button',{name:'重试原审批申请',exact:true}).click();await expect(page.getByText(/服务端状态：pending/)).toBeVisible();for(const family of ['create','submit']){const rows=networkRows().filter(r=>r.method==='POST'&&(family==='create'?r.path==='/v1/releases':r.path.endsWith('approval-submissions')));expect(rows).toHaveLength(2);expect(rows[0].keyHash).toBe(rows[1].keyHash);expect(rows[0].bodyHash).toBe(rows[1].bodyHash);expect(rows[0].version).toBe(rows[1].version);expect(rows[0].responseHash).toBe(rows[1].responseHash);}
  14 | });
  15 | test('stale saved head after reviewed report blocks Release before POST',async({page})=>{
  16 |  await report(page);const data=JSON.parse((await page.getByTestId('raw-backtest-report').textContent())!),path=`/v1/strategies/${data.strategyId}/draft`,head=await control(path);expect((await control(path,{files:{...head.body.files as Record<string,string>,'note.txt':'competing edit'},parameters:head.body.parameters},String(head.body.objectVersion))).status).toBe(200);await page.getByRole('button',{name:'创建不可变 Release',exact:true}).click();await expect(page.locator('main').getByRole('alert').filter({hasText:'Release 准备或创建未完成'})).toBeVisible();expect(networkRows().some(r=>r.method==='POST'&&r.path==='/v1/releases')).toBe(false);
  17 | });
  18 | test('readonly approver can inspect immutable evidence but cannot submit',async({page})=>{await release(page);const count=networkRows().filter(r=>r.method==='POST').length;fault({readonly:true});await page.reload();await authorized(page);await expect(page.getByTestId('raw-release')).toBeAttached();await expect(page.getByRole('button',{name:'提交审批申请',exact:true})).toBeDisabled();expect(networkRows().filter(r=>r.method==='POST')).toHaveLength(count);});
  19 | test('offline clears Release and explicit recovery only reads server facts',async({page})=>{await release(page);const count=networkRows().filter(r=>r.method==='POST').length;await page.evaluate(()=>dispatchEvent(new Event('offline')));await expect(page.getByRole('heading',{name:'Release 访问条件已变化'})).toBeVisible();await expect(page.getByTestId('raw-release')).toHaveCount(0);await page.getByRole('button',{name:/重新/}).click();await authorized(page);await expect(page.getByTestId('raw-release')).toBeAttached();expect(networkRows().filter(r=>r.method==='POST')).toHaveLength(count);});
  20 | test('empty catalog, missing object and malformed UUID remain closed read-only states',async({page})=>{await page.goto('/releases');await authorized(page);await expect(page.getByText('本页没有可见 Release。',{exact:true})).toBeVisible();await page.goto('/releases/aaaaaaaa-1111-4111-8111-111111111111');await authorized(page);await expect(page.locator('main').getByRole('alert')).toContainText('Release 请求未完成');await expect(page.getByLabel('目标选择',{exact:true})).toHaveCount(0);const response=await page.goto('/releases/nope');expect(response?.status()).toBe(404);expect(networkRows().some(r=>r.method==='POST')).toBe(false);});
  21 | 
```