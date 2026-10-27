# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: g8-current.spec.ts >> G8 current P10 P11 show actual server-closed conditions with no assisted entry or writes
- Location: tests/e2e/g8-current.spec.ts:6:5

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('assisted-testnet-admission')
Expected: "closed"
Received: "unavailable"
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByTestId('assisted-testnet-admission')
    14 × locator resolved to <p role="status" class="p10-admission" data-state="unavailable" data-testid="assisted-testnet-admission">尚未核实 Assisted Live（testnet）开放条件；当前不可进入。</p>
       - unexpected value "unavailable"

```

```yaml
- status: 尚未核实 Assisted Live（testnet）开放条件；当前不可进入。
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import {writeFile} from 'node:fs/promises';
  3  | import AxeBuilder from '@axe-core/playwright';
  4  | import {installReferenceHooks,authorized,useSession,networkRows,fault} from './fixtures/frontend-g8-reference';
  5  | installReferenceHooks();
  6  | test('G8 current P10 P11 show actual server-closed conditions with no assisted entry or writes',async({page},info)=>{
> 7  |  useSession('session-approver');await page.goto('/approvals');await authorized(page);await expect(page.getByTestId('assisted-testnet-admission')).toHaveAttribute('data-state','closed');await expect(page.getByTestId('assisted-testnet-admission')).toContainText('暂未开放');await expect(page.getByRole('button',{name:/进入.*Assisted Live/})).toHaveCount(0);await page.screenshot({path:info.outputPath('g8-current-p10.png')});
     |                                                                                                                                                   ^ Error: expect(locator).toHaveAttribute(expected) failed
  8  |  useSession('session-current');await page.goto('/orders');await authorized(page);await expect(page.getByTestId('assisted-testnet-admission')).toHaveAttribute('data-state','closed');await expect(page.getByRole('button',{name:/进入.*Assisted Live/})).toHaveCount(0);await page.setViewportSize({width:390,height:844});await expect(page.getByTestId('assisted-testnet-admission')).toContainText('暂未开放');
  9  |  const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([]);await writeFile(info.outputPath('g8-current-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,violations:axe.violations,incomplete:axe.incomplete,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));await page.screenshot({path:info.outputPath('g8-current-p11-small.png')});
  10 |  expect(networkRows().filter(r=>!r.control&&r.method!=='GET')).toHaveLength(0);await writeFile(info.outputPath('g8-current-admission.json'),JSON.stringify({schema:'quantos-g8-current-browser/v1',sourceCommit:process.env.GITHUB_SHA,source:'ACTUAL_REFERENCE_C01_C09_NOT_NATIVE_ASSISTED_AUTHORITY',p10:'SERVER_CLOSED',p11:'SERVER_CLOSED',viewport:'390x844',businessWrites:0,actualTestnetConnected:false,rows:networkRows()},null,2));
  11 | });
  12 | test('G8 current non-JSON authority refusal clears actual P10 private facts and no assisted route is exposed',async({page},info)=>{
  13 |  useSession('session-approver');await page.goto('/approvals');await authorized(page);await expect(page.getByTestId('assisted-testnet-admission')).toHaveAttribute('data-state','closed');fault({nonJsonPath:'/v1/context',refusal:403});await page.getByRole('button',{name:/刷新列表|刷新审批|刷新/}).first().click();await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await expect(page.locator('[data-route-access="authorized"]')).toHaveCount(0);expect(networkRows().filter(r=>!r.control&&r.method!=='GET')).toHaveLength(0);await writeFile(info.outputPath('g8-current-revocation.json'),JSON.stringify({schema:'quantos-g8-current-browser-revocation/v1',sourceCommit:process.env.GITHUB_SHA,source:'ACTUAL_REFERENCE_WITH_EXPLICIT_NON_JSON_403_TRANSPORT_PROBE',privateFactsCleared:true,businessWrites:0,actualTestnetConnected:false,rows:networkRows()},null,2));
  14 | });
  15 | 
```