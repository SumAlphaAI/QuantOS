# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: native-kill-control.spec.ts >> public native kill UI preserves original intent and joins independent release C10
- Location: tests/e2e/native-kill-control.spec.ts:6:5

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByTestId('native-kill-control').getByLabel('独立解除复核', { exact: true }).locator('option')
Expected: 2
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByTestId('native-kill-control').getByLabel('独立解除复核', { exact: true }).locator('option')
    14 × locator resolved to 0 elements
       - unexpected value "0"

```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import {writeFile} from 'node:fs/promises';
  4  | import {installReferenceHooks,useSession,authorized,control,fault,networkRows,zoneSnapshot} from './fixtures/frontend-g8-reference';
  5  | installReferenceHooks('assisted-mtls-local');
  6  | test('public native kill UI preserves original intent and joins independent release C10',async({page},info)=>{
  7  |  useSession('session-current');await page.goto('/orders');await authorized(page);
  8  |  const panel=page.getByTestId('native-kill-control');await expect(panel.getByTestId('native-kill-state')).toContainText('Generation 0');
  9  |  await panel.getByLabel('停止控制原因',{exact:true}).fill('owned browser stop review');await panel.getByRole('button',{name:'确认停止',exact:true}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel('输入“ENGAGE ACCOUNT KILL”以确认').fill('ENGAGE ACCOUNT KILL');await dialog.getByLabel('MFA 验证码',{exact:true}).fill('123456');fault({dropPath:'/v1/risk/kill-switch/engage'});await dialog.getByRole('button',{name:'验证并提交停止控制',exact:true}).click();await expect(panel).toContainText('停止操作结果未知');await panel.getByRole('button',{name:'恢复原停止请求',exact:true}).click();await expect(panel.getByTestId('native-kill-state')).toContainText('Generation 1');await expect(panel.getByTestId('native-kill-state')).toContainText('原生 已停止');
> 10 |  useSession('session-approver');await page.goto('/orders');await authorized(page);await expect(panel.getByTestId('native-kill-state')).toContainText('Generation 1');await panel.getByLabel('停止控制原因',{exact:true}).fill('independent browser release review');await panel.getByRole('button',{name:'独立复核解除',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('输入“APPROVE ACCOUNT RELEASE”以确认').fill('APPROVE ACCOUNT RELEASE');await dialog.getByLabel('MFA 验证码',{exact:true}).fill('123456');await dialog.getByRole('button',{name:'验证并提交停止控制',exact:true}).click();await expect(panel.getByLabel('独立解除复核',{exact:true}).locator('option')).toHaveCount(2);
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          ^ Error: expect(locator).toHaveCount(expected) failed
  11 |  useSession('session-owner');await page.goto('/orders');await authorized(page);await expect(panel.getByLabel('独立解除复核',{exact:true}).locator('option')).toHaveCount(2);await panel.getByLabel('独立解除复核',{exact:true}).selectOption({index:1});await panel.getByLabel('停止控制原因',{exact:true}).fill('owner explicit release');await panel.getByRole('button',{name:'Owner 解除停止',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('输入“RELEASE ACCOUNT KILL”以确认').fill('RELEASE ACCOUNT KILL');await dialog.getByLabel('MFA 验证码',{exact:true}).fill('123456');await dialog.getByRole('button',{name:'验证并提交停止控制',exact:true}).click();await expect(panel.getByTestId('native-kill-state')).toContainText('Generation 2');await expect(panel.getByTestId('native-kill-state')).toContainText('原生 未停止');
  12 |  const current=await control('/v1/risk/kill-switch',undefined,undefined,{session:'session-owner'});expect(current.body.nativeGeneration).toBe('2');expect(current.body.unknownCommands).toBe(0);const history=current.body.history as {correlationId:string}[];expect(history).toHaveLength(3);const chain=await control('/v1/audit/evidence-chains/'+history[0].correlationId,undefined,undefined,{session:'session-owner'});expect(chain.body.items).toHaveLength(3);
  13 |  const pair=networkRows().filter(r=>!r.control&&r.path==='/v1/risk/kill-switch/engage'&&r.method==='POST');expect(pair).toHaveLength(2);expect(pair[0].keyHash).toBe(pair[1].keyHash);expect(pair[0].bodyHash).toBe(pair[1].bodyHash);expect(zoneSnapshot()?.protocolCalls).toBe(0);
  14 |  const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([]);await writeFile(info.outputPath('native-control-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,violations:axe.violations,incomplete:axe.incomplete,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));await page.screenshot({path:info.outputPath('native-control.png'),fullPage:true});
  15 |  await panel.getByRole('link',{name:'查看停止审计',exact:true}).first().click();await authorized(page);await expect(page.locator('main')).toContainText('assisted.kill_release');
  16 |  await writeFile(info.outputPath('native-control-browser.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,current:current.body,chain:chain.body,originalPair:pair.map(({keyHash,...r})=>({...r,idempotencyDigest:keyHash})),protocolCalls:0,actualTestnet:false,independentRelease:true},null,2));
  17 | });
  18 | 
```