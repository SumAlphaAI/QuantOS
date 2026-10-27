# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend-g8.spec.ts >> G8 actual Paper P10 MFA approval P11 recovery and Audit preserve separate actors without exposing Assisted Live
- Location: tests/e2e/frontend-g8.spec.ts:9:5

# Error details

```
TypeError: Cannot read properties of undefined (reading '0')
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import {writeFile} from 'node:fs/promises';
  3  | import {createHash} from 'node:crypto';
  4  | import AxeBuilder from '@axe-core/playwright';
  5  | import {installReferenceHooks,authorized,control,useSession,fault,networkRows} from './fixtures/frontend-g8-reference';
  6  | installReferenceHooks();
  7  | const operator={session:'session-current' as const};
> 8  | async function seed(){const p=((await control('/v1/proposals',undefined,undefined,operator)).body.items as Record<string,unknown>[])[0]!,q=await control(`/v1/trade-preflight?accountId=${p.accountId}&proposalId=${p.proposalId}`,undefined,undefined,operator);expect((await control(`/v1/proposals/${p.proposalId}/risk-evaluations`,{contextHash:q.body.contextHash},String(p.objectVersion),{...operator,method:'POST'})).status).toBe(202);const a=((await control('/v1/approvals',undefined,undefined,operator)).body.items as Record<string,unknown>[]).find(a=>a.correlationId===p.correlationId)!;return{proposal:p,approval:a};}
     |                                                                                                        ^ TypeError: Cannot read properties of undefined (reading '0')
  9  | test('G8 actual Paper P10 MFA approval P11 recovery and Audit preserve separate actors without exposing Assisted Live',async({page},info)=>{
  10 |  test.setTimeout(60000);const {proposal,approval}=await seed(),aid=String(approval.approvalId);
  11 |  await page.goto('/approvals/'+aid);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();expect(networkRows().filter(r=>!r.control&&r.path.endsWith('/decisions'))).toHaveLength(0);
  12 |  useSession('session-approver');await page.goto('/approvals/'+aid);await authorized(page);await page.getByLabel('我已复核对象、账户、模式、限额影响与证据',{exact:true}).check();await page.getByRole('button',{name:'批准并验证',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('输入“CONFIRM APPROVE”以确认').fill('CONFIRM APPROVE');await dialog.getByLabel('MFA 验证码',{exact:true}).fill('123456');fault({dropPath:`/v1/approvals/${aid}/decisions`});await dialog.getByRole('button',{name:'重新认证并提交审批',exact:true}).click();await expect(page.getByRole('region',{name:'未知结果',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'服务端审批回执',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'恢复原审批请求',exact:true}).click();await expect(page.getByRole('region',{name:'服务端审批回执',exact:true})).toContainText('approved');
  13 |  useSession('session-current');await page.goto('/orders?approvalId='+aid);await authorized(page);await expect(page.getByTestId('command-review')).toContainText(aid);fault({dropPath:'/v1/commands'});await page.getByRole('button',{name:'提交服务端 Command',exact:true}).click();const command=page.getByRole('dialog');await command.getByLabel('输入“SUBMIT COMMAND”以确认').fill('SUBMIT COMMAND');await command.getByRole('button',{name:'确认提交 Command',exact:true}).click();await expect(page.getByRole('region',{name:'未知结果',exact:true})).toBeVisible();await page.getByRole('button',{name:'恢复原请求',exact:true}).click();await expect(page.locator('.p11-detail-title')).toContainText('accepted');const orders=await control('/v1/orders?accountId='+proposal.accountId,undefined,undefined,operator),order=(orders.body.items as Record<string,unknown>[]).find(o=>o.correlationId===proposal.correlationId)!;expect(order.mode).toBe('paper');expect(order.venueKind).toBe('mock');expect(order.fills).toEqual([]);
  14 |  fault({dropPath:`/v1/orders/${order.orderId}/cancel-requests`});await page.getByRole('button',{name:'请求撤单',exact:true}).click();const cancel=page.getByRole('dialog');await cancel.getByLabel('输入“CANCEL ORDER”以确认').fill('CANCEL ORDER');await cancel.getByRole('button',{name:'确认撤单请求',exact:true}).click();await expect(page.getByRole('region',{name:'未知结果',exact:true})).toBeVisible();await page.getByRole('button',{name:'恢复原请求',exact:true}).click();await expect(page.locator('.p11-detail-title')).toContainText('cancelled');
  15 |  await page.goto('/audit/'+proposal.correlationId);await authorized(page);await expect(page.getByText('当前授权范围内链完整',{exact:true})).toBeVisible();const scan=await new AxeBuilder({page}).analyze();expect(scan.violations).toEqual([]);await writeFile(info.outputPath('g8-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,violations:scan.violations,incomplete:scan.incomplete,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));await page.screenshot({path:info.outputPath('g8-paper-audit.png')});
  16 |  const pairs=[`/v1/approvals/${aid}/decisions`,'/v1/commands',`/v1/orders/${order.orderId}/cancel-requests`].map(path=>networkRows().filter(r=>!r.control&&r.path===path&&r.method==='POST'));for(const pair of pairs){expect(pair).toHaveLength(2);for(const key of ['bodyHash','keyHash','version','responseHash'] as const)expect(pair[0][key]).toBe(pair[1][key]);}
  17 |  await writeFile(info.outputPath('g8-journey.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scope:'ACTUAL_PAPER_P10_P11_C10_NOT_ASSISTED_TESTNET',mode:'paper',venueKind:'mock',approvalId:aid,orderId:order.orderId,correlationId:proposal.correlationId,finalOrderStatus:'cancelled',actualTestnetConnected:false,assistedLiveEntry:'NOT_WIRED_NOT_CLAIMED',pairs},null,2));
  18 | });
  19 | test('G8 explicit consumer assisted mode and malformed entry cannot widen current P10 P11 authority',async({page},info)=>{
  20 |  const hash=(s:string)=>'sha256:'+createHash('sha256').update(s).digest('hex'),deliveries:unknown[]=[];
  21 |  await page.route(/\/v1\/(session|context)$/,async route=>{const response=await route.fetch(),original=await response.text(),body=JSON.stringify({...JSON.parse(original),mode:'assisted_live'});deliveries.push({path:new URL(route.request().url()).pathname,originalHash:hash(original),deliveredHash:hash(body),scope:'EXPLICIT_BROWSER_DELIVERY_ONLY_NOT_BFF_IDENTITY'});await route.fulfill({response,body});});
  22 |  for(const path of ['/approvals','/orders']){await page.goto(path);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await expect(page.locator('[data-route-access="authorized"]')).toHaveCount(0);}
  23 |  const n=networkRows().length;await page.goto('/orders?mode=assisted_live&testnet=on');await expect(page.getByRole('heading',{name:'Orders 引用无效',exact:true})).toBeVisible();expect(networkRows()).toHaveLength(n);expect(networkRows().filter(r=>!r.control&&r.method==='POST')).toHaveLength(0);await writeFile(info.outputPath('g8-mode-refusal.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scope:'EXPLICIT_CONSUMER_ASSISTED_MODE_NO_BACKEND_POSITIVE',actualTestnetConnected:false,businessWrites:0,deliveries},null,2));
  24 | });
  25 | 
```