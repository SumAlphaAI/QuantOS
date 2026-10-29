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
Expected substring: "awaiting_second"
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByTestId('assisted-approval-status')
  - Target page, context or browser has been closed

```

```yaml
- alert
- main:
  - paragraph: ASSISTED LIVE · TESTNET
  - heading "Assisted Live 审批" [level=1]
  - paragraph: 账户 44444444-4444-4444-8444-444444444444 · 当前操作人 842e725a-2892-4388-8d3c-7eb11d8c54ab
  - navigation "Assisted Live 导航":
    - link "审批":
      - /url: /approvals
    - link "订单":
      - /url: /orders
  - region "服务端访问条件":
    - status: 当前 testnet 条件有效；每次操作仍会重新核查权限。
    - button "刷新当前事实" [disabled]
  - status: 正在核对或提交，请等待回执。
  - region "当前申请目录":
    - heading "当前申请" [level=2]
    - text: 已核查的 Proposal
    - combobox "已核查的 Proposal" [disabled]:
      - option "请选择" [selected]
      - option "BTCUSDT buy 1 @ 1000 · 01a1851d-b6bb-7f72-a922-5867642c7773"
      - option "BTCUSDT buy 2 @ 1000 · 01a1851d-b6c4-7d93-af65-63f0c0e6b9c6"
      - option "BTCUSDT buy 3 @ 1000 · 01a1851d-b6cc-7133-a383-88ad5b6879bf"
      - option "BTCUSDT buy 4 @ 1000 · 01a1851d-b6d5-7941-8e1d-d3640d53effa"
      - option "BTCUSDT buy 5 @ 1000 · 01a1851d-b6de-7f93-a4f6-ae89e0038e4b"
      - option "BTCUSDT buy 6 @ 1000 · 01a1851d-b6e7-7053-83f8-3830e758439e"
      - option "BTCUSDT buy 7 @ 1000 · 01a1851d-b6f0-72d1-a088-862278083ed9"
      - option "BTCUSDT buy 8 @ 1000 · 01a1851d-b6f8-7f01-b10c-5fda35f407c7"
      - option "BTCUSDT buy 9 @ 1000 · 01a1851d-b701-7133-986c-29554867b325"
      - option "BTCUSDT buy 10 @ 1000 · 01a1851d-b70a-76e2-9609-337c82771feb"
      - option "BTCUSDT buy 11 @ 1000 · 01a1851d-b713-7b53-bc3d-d2b2c39a8adc"
      - option "BTCUSDT buy 12 @ 1000 · 01a1851d-b71b-72c0-8a82-c8233908dbea"
      - option "BTCUSDT buy 13 @ 1000 · 01a1851d-b724-7a20-8cf7-69db809b68d6"
      - option "BTCUSDT buy 14 @ 1000 · 01a1851d-b72d-7ea2-ae42-f82f99255fbf"
      - option "BTCUSDT buy 15 @ 1000 · 01a1851d-b736-7442-ab74-b64de7e2e797"
      - option "BTCUSDT buy 16 @ 1000 · 01a1851d-b73e-7192-926e-50ec0b09ab53"
      - option "BTCUSDT buy 17 @ 1000 · 01a1851d-b747-71e3-ba9a-942d2795b084"
      - option "BTCUSDT buy 18 @ 1000 · 01a1851d-b74f-77f2-a3f5-f7e0f3d6f8cc"
      - option "BTCUSDT buy 19 @ 1000 · 01a1851d-b758-79d0-b098-215cb55fbfe3"
      - option "BTCUSDT buy 20 @ 1000 · 01a1851d-b761-7bb2-8a6d-e110726df811"
      - option "BTCUSDT buy 21 @ 1000 · 01a1851d-b769-7062-baac-b571cb7971d9"
      - option "BTCUSDT buy 22 @ 1000 · 01a1851d-b772-7092-a74b-dc50fa2c7a51"
      - option "BTCUSDT buy 23 @ 1000 · 01a1851d-b77b-79c2-ae30-929ca1675fab"
      - option "BTCUSDT buy 24 @ 1000 · 01a1851d-b784-7c51-850c-c659a532c73e"
      - option "BTCUSDT buy 25 @ 1000 · 01a1851d-b78d-72b1-9839-c98acfe37942"
      - option "BTCUSDT buy 26 @ 1000 · 01a1851d-b795-77b1-a224-63d4dd6c44db"
      - option "BTCUSDT buy 27 @ 1000 · 01a1851d-b79e-77d0-9f51-92cd68757bd3"
      - option "BTCUSDT buy 28 @ 1000 · 01a1851d-b7a7-74a2-8bc0-f0b3afe57871"
      - option "BTCUSDT buy 29 @ 1000 · 01a1851d-b7af-7431-a3b1-7c15b107d99a"
      - option "BTCUSDT buy 30 @ 1000 · 01a1851d-b7b8-7821-b8bd-bdad568bdd15"
      - option "BTCUSDT buy 31 @ 1000 · 01a1851d-b7c1-7252-baa3-e12b49a7ec22"
      - option "BTCUSDT buy 32 @ 1000 · 01a1851d-b7ca-7d31-a70d-d1794f430489"
      - option "BTCUSDT buy 33 @ 1000 · 01a1851d-b7d3-7c03-b4b1-1f8027110960"
      - option "BTCUSDT buy 34 @ 1000 · 01a1851d-b7dc-7e02-b9e0-3761fb1c9c80"
      - option "BTCUSDT buy 35 @ 1000 · 01a1851d-b7e4-7b83-99cd-fc8bd34e17d9"
      - option "BTCUSDT buy 36 @ 1000 · 01a1851d-b7ed-7b31-ac3f-198867ec4d4a"
      - option "BTCUSDT buy 37 @ 1000 · 01a1851d-b7f6-7673-bf82-6351234ed38f"
      - option "BTCUSDT buy 38 @ 1000 · 01a1851d-b7ff-7521-8814-96103449ab47"
      - option "BTCUSDT buy 39 @ 1000 · 01a1851d-b807-70e0-b461-0570a4103172"
      - option "BTCUSDT buy 40 @ 1000 · 01a1851d-b810-7cc3-8d10-6d32b4268389"
      - option "BTCUSDT buy 41 @ 1000 · 01a1851d-b819-7072-948e-a21918ba72b4"
      - option "BTCUSDT buy 42 @ 1000 · 01a1851d-b822-7661-b2ce-46c98c9ff892"
      - option "BTCUSDT buy 43 @ 1000 · 01a1851d-b82b-7782-8117-42e59ccde965"
      - option "BTCUSDT buy 44 @ 1000 · 01a1851d-b833-7c71-824b-c52edcd54a7e"
      - option "BTCUSDT buy 45 @ 1000 · 01a1851d-b83c-7903-8bfc-e2d991887358"
      - option "BTCUSDT buy 46 @ 1000 · 01a1851d-b845-7d72-92c7-2c01f44a2495"
      - option "BTCUSDT buy 47 @ 1000 · 01a1851d-b84e-73d2-a893-3a30ee7d2d6d"
      - option "BTCUSDT buy 48 @ 1000 · 01a1851d-b856-7380-8997-24587e4481ad"
      - option "BTCUSDT buy 49 @ 1000 · 01a1851d-b85f-74d0-a3cf-3b4e28bbf659"
      - option "BTCUSDT buy 50 @ 1000 · 01a1851d-b868-7610-80e5-5a5dfa48f006"
    - button "发起双人审批" [disabled]
    - list:
      - listitem:
        - button "BTCUSDT · awaiting_second · 01a1851d-d0f7-7be2-be95-be9d7f11d1a8" [disabled]
  - region "申请与订单详情":
    - heading "申请与订单详情" [level=2]
    - paragraph: 选择申请以审阅来源、审批和订单事实。
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
> 11 |   useSession(who);await page.goto('/approvals');await authorized(page);await page.getByRole('button',{name:new RegExp(id)}).click();await expect(page.getByTestId('assisted-approval-status')).toContainText(slot===0?'pending':'awaiting_second');await page.getByLabel(ack,{exact:true}).check();await page.getByRole('button',{name:'独立审批并验证 MFA',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('输入“APPROVE TESTNET”以确认').fill('APPROVE TESTNET');await dialog.getByLabel('MFA 验证码',{exact:true}).fill('123456');if(slot===0)fault({dropPath:path+'/approvals'});await dialog.getByRole('button',{name:'验证并批准',exact:true}).click();
     |                                                                                                                                                                                                ^ Error: expect(locator).toContainText(expected) failed
  12 |   if(slot===0){await expect(page.getByRole('region',{name:'未知操作结果'})).toBeVisible();await page.getByRole('button',{name:'恢复原请求',exact:true}).click();}
  13 |   await expect(page.getByTestId('assisted-approval-status')).toContainText(slot===0?'awaiting_second':'approved');
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