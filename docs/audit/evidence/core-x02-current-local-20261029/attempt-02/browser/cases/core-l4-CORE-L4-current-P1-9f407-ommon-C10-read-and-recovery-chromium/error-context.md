# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core-l4.spec.ts >> CORE L4 current P10 P11 mTLS common C10 read and recovery
- Location: tests/e2e/core-l4.spec.ts:7:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('assisted-approval-status')
Expected substring: "approved"
Received string:    "awaiting_second"

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByTestId('assisted-approval-status')
    6 × locator resolved to <dd data-testid="assisted-approval-status">awaiting_second</dd>
      - unexpected value "awaiting_second"
  - Target page, context or browser has been closed

```

```yaml
- definition: awaiting_second
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import {writeFile} from 'node:fs/promises';
  4  | import {installReferenceHooks,useSession,authorized,control,fault,networkRows,zoneSnapshot} from './fixtures/frontend-g8-reference';
  5  | installReferenceHooks('assisted-mtls-local');
  6  | const ack='我已核对账户、方向、数量、限价、对象指纹与审批状态';
  7  | test('CORE L4 current P10 P11 mTLS common C10 read and recovery',async({page},info)=>{
  8  |  useSession('session-current');await page.goto('/approvals');await authorized(page);await expect(page.getByTestId('assisted-native-condition')).toContainText('条件有效');await page.getByLabel('已核查的 Proposal').selectOption({index:1});await page.getByRole('button',{name:'发起双人审批',exact:true}).click();await expect(page.getByTestId('assisted-approval-status')).toContainText('pending');
  9  |  const open=await control('/v1/assisted-testnet/requests',undefined,undefined,{session:'session-current'}),row=(open.body.items as {request:{requestId:string};subject:{subjectHash:string}}[])[0],id=row.request.requestId,path='/v1/assisted-testnet/requests/'+id;
  10 |  for(const [slot,who]of (['session-approver','session-owner'] as const).entries()){
  11 |   useSession(who);await page.goto('/approvals');await authorized(page);await page.getByRole('button',{name:new RegExp(id)}).click();await expect(page.getByTestId('assisted-approval-status')).toContainText(slot===0?'pending':'awaiting_second');await page.getByLabel(ack,{exact:true}).check();await page.getByRole('button',{name:'独立审批并验证 MFA',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('输入“APPROVE TESTNET”以确认').fill('APPROVE TESTNET');await dialog.getByLabel('MFA 验证码',{exact:true}).fill('123456');if(slot===0)fault({dropPath:path+'/approvals'});await dialog.getByRole('button',{name:'验证并批准',exact:true}).click();
  12 |   if(slot===0){await expect(page.getByRole('region',{name:'未知操作结果'})).toBeVisible();await page.getByRole('button',{name:'恢复原请求',exact:true}).click();}
> 13 |   await expect(page.getByTestId('assisted-approval-status')).toContainText(slot===0?'awaiting_second':'approved');
     |                                                              ^ Error: expect(locator).toContainText(expected) failed
  14 |  }
  15 |  useSession('session-current');await page.goto('/orders');await authorized(page);await page.getByRole('button',{name:new RegExp(id)}).click();await page.getByLabel(ack,{exact:true}).check();await page.getByRole('button',{name:'提交已双人批准的 testnet Command',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('输入“SUBMIT ASSISTED TESTNET”以确认').fill('SUBMIT ASSISTED TESTNET');fault({dropPath:path+'/commands'});await dialog.getByRole('button',{name:'确认提交 Command',exact:true}).click();await expect(page.getByRole('region',{name:'未知操作结果'})).toBeVisible();await page.getByRole('button',{name:'恢复原请求',exact:true}).click();await expect(page.getByTestId('assisted-native-order')).toContainText('filled');
  16 |  const audit=await control(path+'/audit',undefined,undefined,{session:'session-current'});expect(audit.body.verified).toBe(true);expect(audit.body.nativeSubmissions).toBe(1);expect(audit.body.items).toHaveLength(2);const latest=await control(path,undefined,undefined,{session:'session-current'});const c=latest.body.command as {commandId:string;subjectHash:string;order:{commandId:string;orderId:string}};expect(c.subjectHash).toBe(row.subject.subjectHash);expect(c.commandId).toBe(c.order.commandId);
  17 |  const nativeZone=zoneSnapshot();expect(nativeZone?.protocolCalls).toBe(1);
  18 |  await page.getByRole('link',{name:'查看共同审计链',exact:true}).click();await authorized(page);await expect(page.getByRole('heading',{name:'Audit Explorer',exact:true})).toBeVisible();await expect(page.locator('main')).toContainText('assisted.command_accepted');await expect(page.getByRole('button',{name:'确认创建导出',exact:true})).toHaveCount(0);
  19 |  const chain=await control('/v1/audit/evidence-chains/'+id,undefined,undefined,{session:'session-current'});expect(chain.status).toBe(200);expect(chain.body.items).toHaveLength(5);for(const n of chain.body.items as {route:string}[])expect(n.route).toBe('/orders?approvalId='+id);
  20 |  const c10Axe=await new AxeBuilder({page}).analyze();expect(c10Axe.violations).toEqual([]);await writeFile(info.outputPath('core-l4-c10-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,violations:c10Axe.violations,incomplete:c10Axe.incomplete,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));
  21 |  await page.screenshot({path:info.outputPath('core-l4-c10.png'),fullPage:true});await page.goto('/orders?approvalId='+id);await authorized(page);await expect(page.getByTestId('assisted-native-order')).toContainText(c.order.orderId);
  22 |  const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([]);await writeFile(info.outputPath('core-l4-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,violations:axe.violations,incomplete:axe.incomplete,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));await page.screenshot({path:info.outputPath('core-l4-p11.png'),fullPage:true});
  23 |  const pairs=[path+'/approvals',path+'/commands'].map(p=>networkRows().filter(r=>!r.control&&r.path===p&&r.method==='POST'));expect(pairs[0]).toHaveLength(3);expect(pairs[1]).toHaveLength(2);for(const pair of [pairs[0].slice(0,2),pairs[1]])for(const k of ['keyHash','bodyHash'] as const)expect(pair[0][k]).toBe(pair[1][k]);await writeFile(info.outputPath('core-l4-journey.json'),JSON.stringify({schema:'quantos-core-l4-browser/v1',sourceCommit:process.env.GITHUB_SHA,identity:'EXPLICIT_REFERENCE_COOKIE_BRIDGE_NOT_REAL_IDP',venueIO:'ACTUAL_L02_MTLS_PROCESS_WITH_OWNED_L01_PORT',zone:nativeZone,c10Nodes:5,c10ReadOnly:true,orderRouteCanonical:true,requestId:id,subjectHash:c.subjectHash,commandId:c.commandId,orderId:c.order.orderId,nativeSubmissions:1,approvalAudits:2,originalPairs:2,actualTestnetConnected:false,pairs:pairs.map(p=>p.map(({keyHash,...r})=>({...r,idempotencyDigest:keyHash})))},null,2));
  24 | });
  25 | 
```