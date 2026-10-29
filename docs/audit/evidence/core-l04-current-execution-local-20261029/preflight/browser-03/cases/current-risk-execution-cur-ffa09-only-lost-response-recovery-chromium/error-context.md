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

Locator: getByTestId('assisted-native-order')
Expected substring: "accepted"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByTestId('assisted-native-order')

```

```yaml
- alert
- main:
  - paragraph: ASSISTED LIVE · TESTNET
  - heading "Assisted Live 订单" [level=1]
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
  - alert: 操作未能确认。请核对当前申请、权限和有效期；未知结果只能恢复原请求。
  - region "未知操作结果":
    - heading "结果未知" [level=2]
    - paragraph: 新写操作已锁定，不会自动补发。原请求到期后只能只读核对。
    - button "恢复原请求"
  - region "当前申请目录":
    - heading "当前申请" [level=2]
    - paragraph: 当前没有申请。
  - region "申请与订单详情":
    - heading "申请与订单详情" [level=2]
    - paragraph: 选择申请以审阅来源、审批和订单事实。
  - region "公共停止控制":
    - heading "公共停止控制" [level=2]
    - paragraph: 停止域仅覆盖当前工作区已接入的执行账户。解除须独立复核及 Owner 确认；旧审批失效，UNKNOWN 与 OPEN 义务保留，不补发。
    - paragraph: Generation 0 · 全局 未停止 · 账户 未停止 · 原生 未停止
    - paragraph: 受保护命令 1 · UNKNOWN 0
    - button "核对当前停止状态"
    - text: 停止范围
    - combobox "停止范围":
      - option "当前账户" [selected]
      - option "当前工作区全局"
    - text: 停止控制原因
    - textbox "停止控制原因"
    - text: 独立解除复核
    - combobox "独立解除复核":
      - option "选择当前复核" [selected]
    - button "确认停止" [disabled]
    - button "独立复核解除" [disabled]
    - button "Owner 解除停止" [disabled]
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
  23 |  await expect(page.getByTestId('assisted-approval-status')).toContainText('pending');
  24 |  const requests=await control('/v1/assisted-testnet/requests',undefined,undefined,{session:'session-current'});
  25 |  const current=(requests.body.items as {subject:{symbol:string};request:{requestId:string;revision:number}}[]).find(r=>r.subject.symbol==='ETHUSDT')!;expect(current.request.revision).toBe(0);await approve(current.request.requestId);
  26 |  await page.goto('/orders');await authorized(page);await page.getByRole('button',{name:new RegExp(current.request.requestId)}).click();await page.getByLabel(ack,{exact:true}).check();
  27 |  const button=page.getByRole('button',{name:'提交已双人批准的 testnet Command',exact:true});await expect(button).toBeEnabled();await button.click();const dialog=page.getByRole('dialog');await dialog.getByLabel('输入“SUBMIT ASSISTED TESTNET”以确认').fill('SUBMIT ASSISTED TESTNET');
> 28 |  fault({dropPath:`/v1/assisted-testnet/requests/${current.request.requestId}/commands`});await dialog.getByRole('button',{name:'确认提交 Command',exact:true}).click();await expect(page.getByRole('region',{name:'未知操作结果'})).toBeVisible();await page.getByRole('button',{name:'恢复原请求',exact:true}).click();await expect(page.getByTestId('assisted-native-order')).toContainText('accepted');await expect(page.getByTestId('assisted-native-order')).toContainText('ETHUSDT');
     |                                                                                                                                                                                                                                                                                                                                                                  ^ Error: expect(locator).toContainText(expected) failed
  29 |  const posts=networkRows().filter(r=>!r.control&&r.method==='POST'&&r.path.endsWith('/commands'));expect(posts).toHaveLength(1);expect(zoneSnapshot()?.protocolCalls).toBe(2);
  30 |  const view=await control(`/v1/assisted-testnet/requests/${current.request.requestId}`,undefined,undefined,{session:'session-current'});
  31 |  const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([]);
  32 |  await page.screenshot({path:info.outputPath('current-execution.png'),fullPage:true});
  33 |  await writeFile(info.outputPath('current-execution-browser.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scope:'ACTUAL_REFERENCE_BFF_OWNED_MTLS_CURRENT_ETH_P11',view:view.body,newSubjectZeroApprovals:true,independentApprovals:2,explicitCommandPosts:1,recovery:'GET_ONLY',protocolCalls:2,actualTestnet:false,limitsRelaxed:false,violations:axe.violations,incomplete:axe.incomplete,manualAccessibility:'NOT_RUN'},null,2));
  34 | });
  35 | 
```