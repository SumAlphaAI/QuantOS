# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fep5-function.spec.ts >> FEP5 approval correlation substitution stays unknown until exact original recovery
- Location: tests/e2e/fep5-function.spec.ts:13:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.selectOption: Target page, context or browser has been closed
Call log:
  - waiting for getByLabel('Proposal', { exact: true })
    - locator resolved to <select aria-label="Proposal">…</select>
  - attempting select option action
    2 × waiting for element to be visible and enabled
      - did not find some options
    - retrying select option action
    - waiting 20ms
    2 × waiting for element to be visible and enabled
      - did not find some options
    - retrying select option action
      - waiting 100ms
    56 × waiting for element to be visible and enabled
       - did not find some options
     - retrying select option action
       - waiting 500ms

```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import {installReferenceHooks,authorized,networkRows,fault,control} from './fixtures/fep5-reference';
  3  | installReferenceHooks();
  4  | const errors=(p:Page)=>p.locator('.p20 > [role=alert]');
> 5  | async function reviewed(p:Page){await p.goto('/trade/BTCUSDT');await authorized(p);await p.getByLabel('Proposal',{exact:true}).selectOption({index:1});await p.getByLabel('行情参考',{exact:true}).selectOption({index:1});await p.getByRole('button',{name:'读取并重新核查',exact:true}).click();await expect(p.getByTestId('trade-snapshot')).toContainText('OWNED_PAPER');await p.getByRole('button',{name:'重新核查并继续',exact:true}).click();await p.getByRole('button',{name:'重新核查并预填 intent',exact:true}).click();await expect(p.getByTestId('intent-ready')).toBeVisible();}
     |                                                                                                                                ^ Error: locator.selectOption: Target page, context or browser has been closed
  6  | async function confirm(p:Page,action:'risk'|'command'){await p.getByRole('button',{name:action==='risk'?'运行风险评估':'提交服务端 Command',exact:true}).click();const d=p.getByRole('dialog');await d.getByLabel(`输入“${action==='risk'?'EVALUATE RISK':'SUBMIT COMMAND'}”以确认`).fill(action==='risk'?'EVALUATE RISK':'SUBMIT COMMAND');await d.getByRole('button',{name:action==='risk'?'确认风险评估申请':'确认提交 Command',exact:true}).click();}
  7  | async function readOrders(){const c=await control('/v1/context'),r=await control('/v1/orders?accountId='+c.body.accountId);expect(r.status).toBe(200);return r.body.items as {orderId:string;proposalId:string;correlationId:string}[];}
  8  | async function approve(){const a=((await control('/v1/approvals')).body.items as Record<string,unknown>[]).find(a=>a.status==='pending')!,m=await control('/v1/auth/mfa/challenges',{purpose:'security_change',code:'123456'},undefined,{method:'POST',session:'session-approver'}),g=await control('/v1/auth/reauth',{challengeRef:m.body.challengeRef},undefined,{method:'POST',session:'session-approver'});expect((await control('/v1/approvals/'+a.approvalId+'/decisions',{decision:'approve',mfaChallengeRef:m.body.challengeRef,reauthTokenRef:g.body.reauthTokenRef},String(a.objectVersion),{method:'POST',session:'session-approver'})).status).toBe(200);return a;}
  9  | test('FEP5 actual Trade to Order Audit cancellation journey keeps correlated server facts',async({page},info)=>{await reviewed(page);await confirm(page,'risk');await expect(page.getByTestId('ticket-approval')).toContainText('pending');const a=await approve();await page.getByRole('button',{name:'读取风险与审批状态',exact:true}).click();await confirm(page,'command');await expect(page.getByRole('region',{name:'Command 受理回执',exact:true})).toContainText('accepted');const orders=await readOrders();expect(orders).toHaveLength(1);const o=orders[0]!;expect(o.correlationId).toBe(a.correlationId);await page.goto('/orders/'+o.orderId);await authorized(page);await page.getByRole('button',{name:'查看完整证据链',exact:true}).click();await expect(page.getByTestId('order-chain')).toContainText('返回链完整');await page.getByRole('button',{name:'请求撤单',exact:true}).click();const d=page.getByRole('dialog');await d.getByLabel('输入“CANCEL ORDER”以确认').fill('CANCEL ORDER');await d.getByRole('button',{name:'确认撤单请求',exact:true}).click();await expect(page.locator('.p11-detail-title')).toContainText('cancelled');await page.goto('/proposals/'+o.proposalId);await authorized(page);await expect(page.getByRole('heading',{name:'Trade Proposals',exact:true})).toBeVisible();await page.goto('/audit/'+o.correlationId);await authorized(page);await expect(page.getByText('当前授权范围内链完整',{exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('fep5-paper-journey.png')});expect(networkRows().filter(r=>!r.control&&r.method==='POST').map(r=>r.path)).toEqual(expect.arrayContaining(['/v1/commands','/v1/orders/'+o.orderId+'/cancel-requests']));});
  10 | test('FEP5 response correlation substitution cannot carry reviewed intent into another approval',async({page})=>{await reviewed(page);fault({correlationFault:true});await confirm(page,'risk');await expect(errors(page)).toBeVisible();await expect(page.getByTestId('ticket-approval')).toHaveCount(0);await expect(page.getByRole('button',{name:'提交服务端 Command',exact:true})).toBeDisabled();expect(networkRows().filter(r=>r.path==='/v1/commands')).toHaveLength(0);expect(networkRows().some(r=>r.source==='SYNTHETIC_FEP5_PROPOSAL_APPROVAL_CORRELATION')).toBe(true);});
  11 | test('FEP5 current actual Kill after independent approval prevents Order creation',async({page})=>{await reviewed(page);await confirm(page,'risk');await expect(page.getByTestId('ticket-approval')).toContainText('pending');await approve();await page.getByRole('button',{name:'读取风险与审批状态',exact:true}).click();const m=await control('/v1/auth/mfa/challenges',{purpose:'security_change',code:'123456'},undefined,{method:'POST',session:'session-owner'}),g=await control('/v1/auth/reauth',{challengeRef:m.body.challengeRef},undefined,{method:'POST',session:'session-owner'});expect((await control('/v1/risk/kill-switch/engage',{accountId:'44444444-4444-4444-8444-444444444444',reason:'FEP5 actual command risk recheck',confirmPhrase:'ENGAGE KILL SWITCH',mfaChallengeRef:m.body.challengeRef,reauthTokenRef:g.body.reauthTokenRef},undefined,{method:'POST',session:'session-owner'})).status).toBe(200);await confirm(page,'command');await expect(errors(page)).toBeVisible();await expect(page.getByRole('region',{name:'Command 受理回执',exact:true})).toHaveCount(0);expect(await readOrders()).toEqual([]);});
  12 | test('FEP5 small screens close open signing/cancel dialogs and retain only read facts',async({page},info)=>{await reviewed(page);await page.getByRole('button',{name:'运行风险评估',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.setViewportSize({width:767,height:1000});await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'运行风险评估',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'提交服务端 Command',exact:true})).toHaveCount(0);expect(networkRows().some(r=>!r.control&&r.method==='POST')).toBe(false);await page.setViewportSize({width:768,height:1000});await expect(page.getByRole('button',{name:'运行风险评估',exact:true})).toBeVisible();await page.setViewportSize({width:1440,height:1000});await confirm(page,'risk');await expect(page.getByTestId('ticket-approval')).toContainText('pending');await approve();await page.getByRole('button',{name:'读取风险与审批状态',exact:true}).click();await confirm(page,'command');await expect(page.getByRole('region',{name:'Command 受理回执',exact:true})).toContainText('accepted');const orders=await readOrders();expect(orders).toHaveLength(1);await page.goto('/orders/'+orders[0]!.orderId);await authorized(page);await page.getByRole('button',{name:'请求撤单',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.setViewportSize({width:390,height:1000});await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'请求撤单',exact:true})).toHaveCount(0);await expect(page.locator('.p11-detail-title')).toContainText('accepted');expect(networkRows().some(r=>r.path.endsWith('/cancel-requests'))).toBe(false);await page.screenshot({path:info.outputPath('fep5-small-screen-order.png')});await page.goto('/proposals/'+orders[0]!.proposalId);await authorized(page);await expect(page.getByRole('button',{name:'请求风险评估',exact:true})).toHaveCount(0);await expect(page.getByText('小屏仅供审阅；请在桌面申请风险评估。',{exact:true})).toBeVisible();});
  13 | test('FEP5 approval correlation substitution stays unknown until exact original recovery',async({page},info)=>{await reviewed(page);await confirm(page,'risk');await expect(page.getByTestId('ticket-approval')).toContainText('pending');const a=((await control('/v1/approvals')).body.items as {approvalId:string;correlationId:string}[])[0]!;fault({actor:'session-approver',decisionCorrelation:true});await page.goto('/approvals/'+a.approvalId);await authorized(page);await page.getByLabel('我已复核对象、账户、模式、限额影响与证据',{exact:true}).check();await page.getByRole('button',{name:'批准并验证',exact:true}).click();const d=page.getByRole('dialog');await d.getByLabel('输入“CONFIRM APPROVE”以确认').fill('CONFIRM APPROVE');await d.getByLabel('MFA 验证码',{exact:true}).fill('123456');await d.getByRole('button',{name:'重新认证并提交审批',exact:true}).click();await expect(page.getByRole('region',{name:'未知结果',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'服务端审批回执',exact:true})).toHaveCount(0);await page.screenshot({path:info.outputPath('fep5-approval-correlation-synthetic.png')});fault({actor:'session-approver'});await page.setViewportSize({width:390,height:1000});await expect(page.getByRole('button',{name:'恢复原审批请求',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'未知结果',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'未知结果',exact:true})).not.toContainText('原验证或审批已过期');await page.screenshot({path:info.outputPath('fep5-small-screen-unknown.png')});await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'恢复原审批请求',exact:true}).click();await expect(page.getByRole('region',{name:'服务端审批回执',exact:true})).toContainText(a.correlationId);const rs=networkRows().filter(r=>!r.control&&r.method==='POST'&&r.path.endsWith('/decisions'));expect(rs).toHaveLength(2);expect(rs[0].keyHash).toBe(rs[1].keyHash);expect(rs[0].bodyHash).toBe(rs[1].bodyHash);});
  14 | 
```