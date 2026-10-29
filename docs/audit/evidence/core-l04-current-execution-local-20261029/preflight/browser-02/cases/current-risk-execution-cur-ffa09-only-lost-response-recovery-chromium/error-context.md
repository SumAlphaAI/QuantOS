# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: current-risk-execution.spec.ts >> current native ETH approval to explicit P11 execution and GET-only lost response recovery
- Location: tests/e2e/current-risk-execution.spec.ts:12:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('assisted-approval-status')
Expected substring: "pending"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByTestId('assisted-approval-status')

```

```yaml
- alert
- main:
  - paragraph: ASSISTED LIVE · TESTNET
  - heading "Assisted Live 审批" [level=1]
  - paragraph: 账户 44444444-4444-4444-8444-444444444444 · 当前操作人 11111111-1111-4111-8111-111111111111
  - navigation "Assisted Live 导航":
    - link "审批":
      - /url: /approvals
    - link "订单":
      - /url: /orders
    - link "C11 执行启用":
      - /url: /admin/flags
  - region "服务端访问条件":
    - status: 当前 testnet 条件有效；每次操作仍会重新核查权限。
    - button "刷新当前事实"
  - region "当前风险评估":
    - heading "当前风险评估" [level=2]
    - paragraph: 按当前账本和可信估值重新评估同一 Proposal。原审批不继承，评估与审批均不提交订单。
    - text: 待评估的 Proposal
    - combobox "待评估的 Proposal":
      - option "请选择" [selected]
      - option "BTCUSDT buy 1 @ 1000 · proposal:owned-current-r04-0"
      - option "BTCUSDT buy 2 @ 1000 · proposal:owned-current-r04-1"
      - option "BTCUSDT buy 3 @ 1000 · proposal:owned-current-r04-2"
      - option "BTCUSDT buy 4 @ 1000 · proposal:owned-current-r04-3"
      - option "BTCUSDT buy 5 @ 1000 · proposal:owned-current-r04-4"
      - option "BTCUSDT buy 6 @ 1000 · proposal:owned-current-r04-5"
      - option "BTCUSDT buy 7 @ 1000 · proposal:owned-current-r04-6"
      - option "BTCUSDT buy 8 @ 1000 · proposal:owned-current-r04-7"
      - option "BTCUSDT buy 9 @ 1000 · proposal:owned-current-r04-8"
      - option "BTCUSDT buy 10 @ 1000 · proposal:owned-current-r04-9"
      - option "BTCUSDT buy 11 @ 1000 · proposal:owned-current-r04-10"
      - option "BTCUSDT buy 12 @ 1000 · proposal:owned-current-r04-11"
      - option "BTCUSDT buy 13 @ 1000 · proposal:owned-current-r04-12"
      - option "BTCUSDT buy 14 @ 1000 · proposal:owned-current-r04-13"
      - option "BTCUSDT buy 15 @ 1000 · proposal:owned-current-r04-14"
      - option "BTCUSDT buy 16 @ 1000 · proposal:owned-current-r04-15"
      - option "BTCUSDT buy 17 @ 1000 · proposal:owned-current-r04-16"
      - option "BTCUSDT buy 18 @ 1000 · proposal:owned-current-r04-17"
      - option "BTCUSDT buy 19 @ 1000 · proposal:owned-current-r04-18"
      - option "BTCUSDT buy 20 @ 1000 · proposal:owned-current-r04-19"
      - option "BTCUSDT buy 21 @ 1000 · proposal:owned-current-r04-20"
      - option "BTCUSDT buy 22 @ 1000 · proposal:owned-current-r04-21"
      - option "BTCUSDT buy 23 @ 1000 · proposal:owned-current-r04-22"
      - option "BTCUSDT buy 24 @ 1000 · proposal:owned-current-r04-23"
      - option "BTCUSDT buy 25 @ 1000 · proposal:owned-current-r04-24"
      - option "BTCUSDT buy 26 @ 1000 · proposal:owned-current-r04-25"
      - option "BTCUSDT buy 27 @ 1000 · proposal:owned-current-r04-26"
      - option "BTCUSDT buy 28 @ 1000 · proposal:owned-current-r04-27"
      - option "BTCUSDT buy 29 @ 1000 · proposal:owned-current-r04-28"
      - option "BTCUSDT buy 30 @ 1000 · proposal:owned-current-r04-29"
      - option "BTCUSDT buy 31 @ 1000 · proposal:owned-current-r04-30"
      - option "BTCUSDT buy 32 @ 1000 · proposal:owned-current-r04-31"
      - option "BTCUSDT buy 33 @ 1000 · proposal:owned-current-r04-32"
      - option "BTCUSDT buy 34 @ 1000 · proposal:owned-current-r04-33"
      - option "BTCUSDT buy 35 @ 1000 · proposal:owned-current-r04-34"
      - option "BTCUSDT buy 36 @ 1000 · proposal:owned-current-r04-35"
      - option "BTCUSDT buy 37 @ 1000 · proposal:owned-current-r04-36"
      - option "BTCUSDT buy 38 @ 1000 · proposal:owned-current-r04-37"
      - option "BTCUSDT buy 39 @ 1000 · proposal:owned-current-r04-38"
      - option "BTCUSDT buy 40 @ 1000 · proposal:owned-current-r04-39"
      - option "BTCUSDT buy 41 @ 1000 · proposal:owned-current-r04-40"
      - option "BTCUSDT buy 42 @ 1000 · proposal:owned-current-r04-41"
      - option "BTCUSDT buy 43 @ 1000 · proposal:owned-current-r04-42"
      - option "BTCUSDT buy 44 @ 1000 · proposal:owned-current-r04-43"
      - option "BTCUSDT buy 45 @ 1000 · proposal:owned-current-r04-44"
      - option "BTCUSDT buy 46 @ 1000 · proposal:owned-current-r04-45"
      - option "BTCUSDT buy 47 @ 1000 · proposal:owned-current-r04-46"
      - option "BTCUSDT buy 48 @ 1000 · proposal:owned-current-r04-47"
      - option "BTCUSDT buy 49 @ 1000 · proposal:owned-current-r04-48"
      - option "BTCUSDT buy 50 @ 1000 · proposal:owned-current-r04-49"
      - option "ETHUSDT buy 1 @ 1000 · proposal:owned-current-unreviewed-eth"
    - button "核对当前估值" [disabled]
    - status:
      - paragraph: 当前估值可用于评估，仍须核对原截止。
      - term: 权益
      - definition: 10099.99 USDT
      - term: Gross / Net exposure
      - definition: 1100 / 1100
      - term: 来源版本 / generation
      - definition: 1 / 0
      - term: 原截止
      - definition: 2026-10-29T14:18:38.101Z
      - term: 快照指纹
      - definition: sha256:4bbaf7266a3468e003d20663dcf6a1df65a0e9d75d0d0994049fcd3c5eb0ecb8
    - button "评估当前风险" [disabled]
    - region "风险评估结果":
      - heading "需要新的独立审批 · ApprovalRequired" [level=3]
      - paragraph: 决定 01a18806-83d8-71f3-afaf-69b5d19fae0c
      - paragraph: Proposal 指纹 sha256:f7f3de07b91794865836b684e9179d94a3b68bda1b2637dabde8f703713b002a
      - paragraph: 原截止 2026-10-29T14:18:38.101Z
      - paragraph: 新 Subject 01a18806-83d8-71f3-afaf-69c3f15fd084 · 需两名不同审批者及 MFA。旧审批不会迁移，执行接续仍未开放。
      - button "为新 Subject 发起独立审批"
  - alert: 操作未能确认。请核对当前申请、权限和有效期；未知结果只能恢复原请求。
  - region "当前申请目录":
    - heading "当前申请" [level=2]
    - text: 已核查的 Proposal
    - combobox "已核查的 Proposal":
      - option "请选择" [selected]
      - option "BTCUSDT buy 1 @ 1000 · 01a18806-6f19-7ab1-9885-6176d44b6403"
      - option "BTCUSDT buy 2 @ 1000 · 01a18806-6f22-7fb0-946a-6f5b424818ba"
      - option "BTCUSDT buy 3 @ 1000 · 01a18806-6f2c-7cc0-8455-e23b8f4b5975"
      - option "BTCUSDT buy 4 @ 1000 · 01a18806-6f35-7b52-b978-12f4023dcd02"
      - option "BTCUSDT buy 5 @ 1000 · 01a18806-6f3f-7783-bcd4-134e60803922"
      - option "BTCUSDT buy 6 @ 1000 · 01a18806-6f49-7e73-8275-bef7b86ef3d9"
      - option "BTCUSDT buy 7 @ 1000 · 01a18806-6f53-78e2-8bb9-4c36ca569740"
      - option "BTCUSDT buy 8 @ 1000 · 01a18806-6f5c-7172-a7c4-32eeb733b045"
      - option "BTCUSDT buy 9 @ 1000 · 01a18806-6f66-7fd0-90c6-4d3308b53e22"
      - option "BTCUSDT buy 10 @ 1000 · 01a18806-6f70-7b00-b39c-e0d15362f646"
      - option "BTCUSDT buy 11 @ 1000 · 01a18806-6f79-7aa1-b85a-13dafdc424d4"
      - option "BTCUSDT buy 12 @ 1000 · 01a18806-6f83-7421-8597-d967875b808e"
      - option "BTCUSDT buy 13 @ 1000 · 01a18806-6f8d-7370-a6c5-2b08fa9c8421"
      - option "BTCUSDT buy 14 @ 1000 · 01a18806-6f96-70a3-ba62-1b526b815ed7"
      - option "BTCUSDT buy 15 @ 1000 · 01a18806-6fa0-79b1-a72b-3913cfc50863"
      - option "BTCUSDT buy 16 @ 1000 · 01a18806-6fa9-7250-8374-27ad4d303865"
      - option "BTCUSDT buy 17 @ 1000 · 01a18806-6fb2-76f0-aa2d-0a806076940c"
      - option "BTCUSDT buy 18 @ 1000 · 01a18806-6fbb-7172-870b-f3eb7e02a3ce"
      - option "BTCUSDT buy 19 @ 1000 · 01a18806-6fc4-7931-b03a-b3fd4b7ceaaf"
      - option "BTCUSDT buy 20 @ 1000 · 01a18806-6fcd-7b32-8763-e04fef618175"
      - option "BTCUSDT buy 21 @ 1000 · 01a18806-6fd6-71c1-ad62-5e0e46c05bc2"
      - option "BTCUSDT buy 22 @ 1000 · 01a18806-6fdf-75b3-878e-b3432645c72c"
      - option "BTCUSDT buy 23 @ 1000 · 01a18806-6fe8-7261-9726-92c67b148336"
      - option "BTCUSDT buy 24 @ 1000 · 01a18806-6ff1-7581-b3fc-43a2613efee7"
      - option "BTCUSDT buy 25 @ 1000 · 01a18806-6ffa-7ff3-a4cb-71a9f1c56852"
      - option "BTCUSDT buy 26 @ 1000 · 01a18806-7003-7051-b43a-4f738aa226b0"
      - option "BTCUSDT buy 27 @ 1000 · 01a18806-700d-7742-93fc-9f9e1be51bb6"
      - option "BTCUSDT buy 28 @ 1000 · 01a18806-7016-7ac1-ba33-2f853ca525ca"
      - option "BTCUSDT buy 29 @ 1000 · 01a18806-701f-7523-b0c2-217bd46793c8"
      - option "BTCUSDT buy 30 @ 1000 · 01a18806-7028-7523-ab3c-27519da69a8f"
      - option "BTCUSDT buy 31 @ 1000 · 01a18806-7031-7701-ab9c-caa344310dab"
      - option "BTCUSDT buy 32 @ 1000 · 01a18806-703a-7fc1-888b-43a152b684f3"
      - option "BTCUSDT buy 33 @ 1000 · 01a18806-7043-7d20-8912-d5cc00b2d2bb"
      - option "BTCUSDT buy 34 @ 1000 · 01a18806-704c-7780-a907-fd8b78c474ce"
      - option "BTCUSDT buy 35 @ 1000 · 01a18806-7056-7941-915b-2a543d133372"
      - option "BTCUSDT buy 36 @ 1000 · 01a18806-705f-7240-b8a1-68540a372c25"
      - option "BTCUSDT buy 37 @ 1000 · 01a18806-7068-7a53-a347-efa97de64c88"
      - option "BTCUSDT buy 38 @ 1000 · 01a18806-7072-7b43-b925-d974ad12da1a"
      - option "BTCUSDT buy 39 @ 1000 · 01a18806-707b-7ef2-be24-70d7353a4a55"
      - option "BTCUSDT buy 40 @ 1000 · 01a18806-7084-7e91-93b9-b5a3e667c482"
      - option "BTCUSDT buy 41 @ 1000 · 01a18806-708e-73b0-a72c-73394e3fc188"
      - option "BTCUSDT buy 42 @ 1000 · 01a18806-7097-75e1-b294-2618e6b38e60"
      - option "BTCUSDT buy 43 @ 1000 · 01a18806-70a0-7811-bee6-90c43efe4f3f"
      - option "BTCUSDT buy 44 @ 1000 · 01a18806-70a9-7b73-a10d-cc41e0ac8ce7"
      - option "BTCUSDT buy 45 @ 1000 · 01a18806-70b2-71e1-ac90-0b5352195ef2"
      - option "BTCUSDT buy 46 @ 1000 · 01a18806-70bc-7d12-bc44-3558d260e786"
      - option "BTCUSDT buy 47 @ 1000 · 01a18806-70c5-7351-914c-53538801610e"
      - option "BTCUSDT buy 48 @ 1000 · 01a18806-70ce-7650-b4ce-20f04cf710c7"
      - option "BTCUSDT buy 49 @ 1000 · 01a18806-70d8-78d3-98b6-2a81a7f0e7f9"
      - option "BTCUSDT buy 50 @ 1000 · 01a18806-70e1-7f61-b1a1-798a45137d68"
    - button "发起双人审批" [disabled]
    - paragraph: 当前没有申请。
  - region "申请与订单详情":
    - heading "申请与订单详情" [level=2]
    - paragraph: 选择申请以审阅来源、审批和订单事实。
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import {writeFile} from 'node:fs/promises';
  4  | import {installReferenceHooks,control,useSession,authorized,publishOwnedValuation,fault,networkRows,zoneSnapshot} from './fixtures/frontend-g8-reference';
  5  | installReferenceHooks('assisted-mtls-local',true,true);
  6  | const ack='我已核对账户、方向、数量、限价、对象指纹与审批状态';
  7  | async function approve(id:string){for(const[slot,session]of(['session-approver','session-owner']as const).entries()){
  8  |  const m=await control('/v1/auth/mfa/challenges',{purpose:'security_change',code:'123456'},undefined,{session,method:'POST'});
  9  |  const a=await control('/v1/auth/reauth',{challengeRef:m.body.challengeRef},undefined,{session,method:'POST'});
  10 |  const r=await control(`/v1/assisted-testnet/requests/${id}/approvals`,{expectedRevision:slot,mfaChallengeRef:m.body.challengeRef,reauthTokenRef:a.body.reauthTokenRef},undefined,{session,method:'POST'});expect(r.status).toBe(200);
  11 | }}
  12 | test('current native ETH approval to explicit P11 execution and GET-only lost response recovery',async({page},info)=>{
  13 |  const rows=await control('/v1/assisted-testnet/subjects',undefined,undefined,{session:'session-current'});
  14 |  const subject=(rows.body.items as {subjectId:string;quantity:string}[]).find(s=>s.quantity==='1')!;
  15 |  const open=await control('/v1/assisted-testnet/requests',{subjectId:subject.subjectId},undefined,{session:'session-current',method:'POST'});const bootstrap=(open.body.request as {requestId:string}).requestId;await approve(bootstrap);
  16 |  expect((await control(`/v1/assisted-testnet/requests/${bootstrap}/commands`,{expectedRevision:2},undefined,{session:'session-current',method:'POST'})).status).toBe(200);
  17 |  const ledger=await control("/v1/assisted-testnet/ledger",undefined,undefined,{session:"session-current"});await publishOwnedValuation(ledger.body);useSession('session-current');await page.goto('/approvals');await authorized(page);
  18 |  const catalog=await control('/v1/assisted-testnet/risk-review-candidates',undefined,undefined,{session:'session-current'});const candidate=(catalog.body.items as {subjectId:string;symbol:string}[]).find(c=>c.symbol==='ETHUSDT')!;
  19 |  const panel=page.getByTestId('native-risk-review');await panel.getByLabel('待评估的 Proposal',{exact:true}).selectOption(candidate.subjectId);
  20 |  await panel.getByRole('button',{name:'核对当前估值',exact:true}).click();await panel.getByRole('button',{name:'评估当前风险',exact:true}).click();
  21 |  await expect(panel.getByTestId('native-risk-result')).toContainText('ApprovalRequired');
  22 |  await panel.getByRole('button',{name:'为新 Subject 发起独立审批',exact:true}).click();
> 23 |  await expect(page.getByTestId('assisted-approval-status')).toContainText('pending');
     |                                                             ^ Error: expect(locator).toContainText(expected) failed
  24 |  const requests=await control('/v1/assisted-testnet/requests',undefined,undefined,{session:'session-current'});
  25 |  const current=(requests.body.items as {subject:{symbol:string};request:{requestId:string;revision:number}}[]).find(r=>r.subject.symbol==='ETHUSDT')!;expect(current.request.revision).toBe(0);await approve(current.request.requestId);
  26 |  await page.goto('/orders');await authorized(page);await page.getByRole('button',{name:new RegExp(current.request.requestId)}).click();await page.getByLabel(ack,{exact:true}).check();
  27 |  const button=page.getByRole('button',{name:'提交已双人批准的 testnet Command',exact:true});await expect(button).toBeEnabled();await button.click();const dialog=page.getByRole('dialog');await dialog.getByLabel('输入“SUBMIT ASSISTED TESTNET”以确认').fill('SUBMIT ASSISTED TESTNET');
  28 |  fault({dropPath:`/v1/assisted-testnet/requests/${current.request.requestId}/commands`});await dialog.getByRole('button',{name:'确认提交 Command',exact:true}).click();await expect(page.getByRole('region',{name:'未知操作结果'})).toBeVisible();await page.getByRole('button',{name:'恢复原请求',exact:true}).click();await expect(page.getByTestId('assisted-native-order')).toContainText('accepted');await expect(page.getByTestId('assisted-native-order')).toContainText('ETHUSDT');
  29 |  const posts=networkRows().filter(r=>!r.control&&r.method==='POST'&&r.path.endsWith('/commands'));expect(posts).toHaveLength(1);expect(zoneSnapshot()?.protocolCalls).toBe(2);
  30 |  const view=await control(`/v1/assisted-testnet/requests/${current.request.requestId}`,undefined,undefined,{session:'session-current'});
  31 |  const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([]);
  32 |  await page.screenshot({path:info.outputPath('current-execution.png'),fullPage:true});
  33 |  await writeFile(info.outputPath('current-execution-browser.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scope:'ACTUAL_REFERENCE_BFF_OWNED_MTLS_CURRENT_ETH_P11',view:view.body,newSubjectZeroApprovals:true,independentApprovals:2,explicitCommandPosts:1,recovery:'GET_ONLY',protocolCalls:2,actualTestnet:false,limitsRelaxed:false,violations:axe.violations,incomplete:axe.incomplete,manualAccessibility:'NOT_RUN'},null,2));
  34 | });
  35 | 
```