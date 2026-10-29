# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: current-risk-execution.spec.ts >> current native ETH approval to explicit P11 execution and GET-only lost response recovery
- Location: tests/e2e/current-risk-execution.spec.ts:13:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('assisted-native-order')
Expected substring: "accepted"
Received string:    "Order order:769bba96c7bb5da5a91025c0909a7bd0f94059f6b955acce1f87d287f5fd0352 · filled · 已成交 1"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByTestId('assisted-native-order')
    9 × locator resolved to <p data-testid="assisted-native-order">…</p>
      - unexpected value "Order order:769bba96c7bb5da5a91025c0909a7bd0f94059f6b955acce1f87d287f5fd0352 · filled · 已成交 1"

```

```yaml
- paragraph: Order order:769bba96c7bb5da5a91025c0909a7bd0f94059f6b955acce1f87d287f5fd0352 · filled · 已成交 1
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import {bffZodSchemas} from '@sumalpha/api-client';
  4  | import {writeFile} from 'node:fs/promises';
  5  | import {installReferenceHooks,control,useSession,authorized,publishOwnedValuation,fault,networkRows,zoneSnapshot} from './fixtures/frontend-g8-reference';
  6  | installReferenceHooks('assisted-mtls-local',true,true);
  7  | const ack='我已核对账户、方向、数量、限价、对象指纹与审批状态';
  8  | async function approve(id:string){for(const[slot,session]of(['session-approver','session-owner']as const).entries()){
  9  |  const m=await control('/v1/auth/mfa/challenges',{purpose:'security_change',code:'123456'},undefined,{session,method:'POST'});
  10 |  const a=await control('/v1/auth/reauth',{challengeRef:m.body.challengeRef},undefined,{session,method:'POST'});
  11 |  const r=await control(`/v1/assisted-testnet/requests/${id}/approvals`,{expectedRevision:slot,mfaChallengeRef:m.body.challengeRef,reauthTokenRef:a.body.reauthTokenRef},undefined,{session,method:'POST'});expect(r.status).toBe(200);
  12 | }}
  13 | test('current native ETH approval to explicit P11 execution and GET-only lost response recovery',async({page},info)=>{
  14 |  const rows=await control('/v1/assisted-testnet/subjects',undefined,undefined,{session:'session-current'});
  15 |  const subject=(rows.body.items as {subjectId:string;quantity:string}[]).find(s=>s.quantity==='1')!;
  16 |  const open=await control('/v1/assisted-testnet/requests',{subjectId:subject.subjectId},undefined,{session:'session-current',method:'POST'});const bootstrap=(open.body.request as {requestId:string}).requestId;await approve(bootstrap);
  17 |  expect((await control(`/v1/assisted-testnet/requests/${bootstrap}/commands`,{expectedRevision:2},undefined,{session:'session-current',method:'POST'})).status).toBe(200);
  18 |  const ledger=await control("/v1/assisted-testnet/ledger",undefined,undefined,{session:"session-current"});await publishOwnedValuation(ledger.body);useSession('session-current');await page.goto('/approvals');await authorized(page);
  19 |  const catalog=await control('/v1/assisted-testnet/risk-review-candidates',undefined,undefined,{session:'session-current'});const candidate=(catalog.body.items as {subjectId:string;symbol:string}[]).find(c=>c.symbol==='ETHUSDT')!;
  20 |  const panel=page.getByTestId('native-risk-review');await panel.getByLabel('待评估的 Proposal',{exact:true}).selectOption(candidate.subjectId);
  21 |  await panel.getByRole('button',{name:'核对当前估值',exact:true}).click();await panel.getByRole('button',{name:'评估当前风险',exact:true}).click();
  22 |  await expect(panel.getByTestId('native-risk-result')).toContainText('ApprovalRequired');
  23 |  await panel.getByRole('button',{name:'为新 Subject 发起独立审批',exact:true}).click();
  24 |  await expect(page.getByTestId('assisted-approval-status')).toContainText('pending');
  25 |  const requests=await control('/v1/assisted-testnet/requests',undefined,undefined,{session:'session-current'});
  26 |  const current=(requests.body.items as {subject:{symbol:string};request:{requestId:string;revision:number}}[]).find(r=>r.subject.symbol==='ETHUSDT')!;expect(current.request.revision).toBe(0);await approve(current.request.requestId);
  27 |  await page.goto('/orders');await authorized(page);await page.getByRole('button',{name:new RegExp(current.request.requestId)}).click();await page.getByLabel(ack,{exact:true}).check();
  28 |  const button=page.getByRole('button',{name:'提交已双人批准的 testnet Command',exact:true});await expect(button).toBeEnabled();await button.click();const dialog=page.getByRole('dialog');await dialog.getByLabel('输入“SUBMIT ASSISTED TESTNET”以确认').fill('SUBMIT ASSISTED TESTNET');
> 29 |  fault({dropPath:`/v1/assisted-testnet/requests/${current.request.requestId}/commands`});await dialog.getByRole('button',{name:'确认提交 Command',exact:true}).click();await expect(page.getByRole('region',{name:'未知操作结果'})).toBeVisible();const debug=await control(`/v1/assisted-testnet/requests/${current.request.requestId}`,undefined,undefined,{session:'session-current'});await writeFile(info.outputPath('current-execution-response.json'),JSON.stringify(debug.body,null,2));const parsed=bffZodSchemas.AssistedRequestView.safeParse(debug.body);expect(parsed.success,JSON.stringify(parsed.error)).toBe(true);await page.getByRole('button',{name:'恢复原请求',exact:true}).click();await expect(page.getByTestId('assisted-native-order')).toContainText('accepted');await expect(page.getByTestId('assisted-native-order')).toContainText('ETHUSDT');
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    ^ Error: expect(locator).toContainText(expected) failed
  30 |  const posts=networkRows().filter(r=>!r.control&&r.method==='POST'&&r.path.endsWith('/commands'));expect(posts).toHaveLength(1);expect(zoneSnapshot()?.protocolCalls).toBe(2);
  31 |  const view=await control(`/v1/assisted-testnet/requests/${current.request.requestId}`,undefined,undefined,{session:'session-current'});
  32 |  const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([]);
  33 |  await page.screenshot({path:info.outputPath('current-execution.png'),fullPage:true});
  34 |  await writeFile(info.outputPath('current-execution-browser.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scope:'ACTUAL_REFERENCE_BFF_OWNED_MTLS_CURRENT_ETH_P11',view:view.body,newSubjectZeroApprovals:true,independentApprovals:2,explicitCommandPosts:1,recovery:'GET_ONLY',protocolCalls:2,actualTestnet:false,limitsRelaxed:false,violations:axe.violations,incomplete:axe.incomplete,manualAccessibility:'NOT_RUN'},null,2));
  35 | });
  36 | 
```