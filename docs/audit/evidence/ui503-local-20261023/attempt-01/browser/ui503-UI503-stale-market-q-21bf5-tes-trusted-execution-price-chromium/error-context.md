# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui503.spec.ts >> UI503 stale market quote never substitutes trusted execution price
- Location: tests/e2e/ui503.spec.ts:14:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('alert')
Expected substring: "来源校验失败"
Error: strict mode violation: getByRole('alert') resolved to 2 elements:
    1) <p role="alert" class="trade-error">预检未完成或来源校验失败，请重新核查。</p> aka getByText('预检未完成或来源校验失败，请重新核查。')
    2) <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div> aka locator('[id="__next-route-announcer__"]')

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByRole('alert')
    - locator resolved to <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div>
    - unexpected value ""

```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import {writeFile} from 'node:fs/promises';
  4  | import {installReferenceHooks,authorized,networkRows,fault,control} from './fixtures/ui503-reference';
  5  | installReferenceHooks();
  6  | const current=(p:Page)=>p.getByTestId('trade-snapshot'),draft=(p:Page)=>p.getByRole('region',{name:'Intent 草稿',exact:true});
  7  | async function open(p:Page){await p.goto('/trade');await authorized(p);await expect(p.getByLabel('Proposal',{exact:true}).locator('option')).toHaveCount(2);}
  8  | async function select(p:Page){await p.getByLabel('Proposal',{exact:true}).selectOption({index:1});await p.getByLabel('行情参考',{exact:true}).selectOption({index:1});await p.getByRole('button',{name:'读取并重新核查',exact:true}).click();await expect(current(p)).toBeVisible();}
  9  | const next=(p:Page)=>p.getByRole('button',{name:'重新核查并继续',exact:true}),prefill=(p:Page)=>p.getByRole('button',{name:'重新核查并预填 intent',exact:true});
  10 | test('UI503 real sources on each step prefill exact intent without command or mutation',async({page})=>{await open(page);await select(page);await expect(current(page)).toContainText('权益余额（非可用现金）');await next(page).click();await prefill(page).click();await expect(draft(page)).toContainText('"executable": false');await expect(draft(page)).toContainText('"limitPrice": "100"');await expect(draft(page)).not.toContainText('commandRef');await expect(current(page)).toContainText('资金可用性未核验');expect(networkRows().filter(r=>r.path==='/v1/markets/quotes')).toHaveLength(3);expect(networkRows().filter(r=>r.path==='/v1/order-capabilities')).toHaveLength(6);expect(networkRows().every(r=>r.method==='GET')).toBe(true);});
  11 | test('UI503 proposal deep link reload remains a reference only and exact market selection is required',async({page})=>{await open(page);const id=await page.getByLabel('Proposal',{exact:true}).locator('option').nth(1).getAttribute('value');await page.goto('/trade?proposalId='+id);await authorized(page);await expect(page.getByRole('alert')).toContainText('请选择一个精确的行情参考');await expect(draft(page)).toHaveCount(0);expect(networkRows().every(r=>r.method==='GET')).toBe(true);await page.reload();await authorized(page);await expect(page.getByLabel('Proposal',{exact:true})).toHaveValue(id!);});
  12 | test('UI503 preflight version changes stop at review and never silently prefill',async({page})=>{await open(page);await select(page);fault({version:true});await next(page).click();await expect(page.getByRole('alert')).toContainText('来源已变化，已回到第1步');await expect(current(page)).toContainText('/ 1 / active');await expect(draft(page)).toHaveCount(0);expect(networkRows().every(r=>r.method==='GET')).toBe(true);});
  13 | test('UI503 unhealthy execution venue and reduced limits block local intent completion',async({page})=>{fault({unhealthy:true,smallLimit:true});await open(page);await select(page);await expect(current(page)).toContainText('unhealthy');await expect(current(page)).toContainText('deny');await next(page).click();await expect(page.getByRole('alert')).toContainText('当前预检、健康或限额拒绝');await expect(draft(page)).toHaveCount(0);});
> 14 | test('UI503 stale market quote never substitutes trusted execution price',async({page})=>{fault({quoteStale:true});await open(page);await page.getByLabel('Proposal',{exact:true}).selectOption({index:1});await page.getByLabel('行情参考',{exact:true}).selectOption({index:1});await page.getByRole('button',{name:'读取并重新核查',exact:true}).click();await expect(page.getByRole('alert')).toContainText('来源校验失败');await expect(current(page)).toHaveCount(0);await expect(draft(page)).toHaveCount(0);});
     |                                                                                                                                                                                                                                                                                                                                                                                        ^ Error: expect(locator).toContainText(expected) failed
  15 | test('UI503 absent opt-in ticket context is refused instead of assuming a cash balance or venue health',async({page})=>{fault({noTicket:true});await open(page);await page.getByLabel('Proposal',{exact:true}).selectOption({index:1});await page.getByLabel('行情参考',{exact:true}).selectOption({index:1});await page.getByRole('button',{name:'读取并重新核查',exact:true}).click();await expect(page.getByRole('alert')).toContainText('来源校验失败');await expect(current(page)).toHaveCount(0);expect(networkRows().every(r=>r.method==='GET')).toBe(true);});
  16 | test('UI503 expired proposal cannot progress or read evaluation context',async({page})=>{fault({expired:true});await open(page);await page.getByLabel('Proposal',{exact:true}).selectOption({index:1});await page.getByRole('button',{name:'读取并重新核查',exact:true}).click();await expect(page.getByRole('alert')).toContainText('已过期');expect(networkRows().some(r=>r.path==='/v1/trade-preflight')).toBe(false);await expect(draft(page)).toHaveCount(0);});
  17 | test('UI503 actual account kill is rechecked as a risk refusal without ticket mutations',async({page})=>{await open(page);const mfa=await control('/v1/auth/mfa/challenges',{purpose:'security_change',code:'123456'},undefined,{method:'POST',session:'session-owner'}),grant=await control('/v1/auth/reauth',{challengeRef:mfa.body.challengeRef},undefined,{method:'POST',session:'session-owner'});expect((await control('/v1/risk/kill-switch/engage',{accountId:'44444444-4444-4444-8444-444444444444',reason:'owned UI503 refusal probe',confirmPhrase:'ENGAGE KILL SWITCH',mfaChallengeRef:mfa.body.challengeRef,reauthTokenRef:grant.body.reauthTokenRef},undefined,{method:'POST',session:'session-owner'})).status).toBe(200);await select(page);await expect(current(page)).toContainText('AccountKill');await expect(draft(page)).toHaveCount(0);expect(networkRows().filter(r=>!r.control).every(r=>r.method==='GET')).toBe(true);});
  18 | test('UI503 stream failure blocks continuation and reads do not retry automatically',async({page})=>{await open(page);await select(page);const before=networkRows().length;fault({streamError:true});await next(page).click();await expect(page.getByRole('alert')).toBeVisible();await expect(draft(page)).toHaveCount(0);expect(networkRows().slice(before).every(r=>r.method==='GET')).toBe(true);});
  19 | test('UI503 429 uses bounded explicit cooldown and never exposes raw private backend message',async({page})=>{fault({rateLimit:true});await open(page);await page.getByLabel('Proposal',{exact:true}).selectOption({index:1});await page.getByLabel('行情参考',{exact:true}).selectOption({index:1});await page.getByRole('button',{name:'读取并重新核查',exact:true}).click();await expect(page.getByRole('alert')).toContainText('冷却');await expect(page.getByText('private SQL',{exact:false})).toHaveCount(0);await expect(page.getByRole('button',{name:'读取并重新核查',exact:true})).toBeDisabled();});
  20 | test('UI503 viewer unknown and injected route cannot read unauthorized domain facts',async({page})=>{fault({readonly:true});await page.goto('/trade');await expect(page.locator('[data-route-access="denied"]')).toBeVisible();expect(networkRows().some(r=>r.path==='/v1/proposals')).toBe(false);fault({});await page.goto('/trade?proposalId=aaaaaaaa-1111-4111-8111-111111111111');await authorized(page);await expect(page.getByRole('alert')).toContainText('建议不存在');const count=networkRows().length;await page.goto('/trade?proposalId=bad&accountId=evil');await expect(page.getByRole('heading',{name:'Trade Ticket 引用无效',exact:true})).toBeVisible();expect(networkRows()).toHaveLength(count);expect((await page.goto('/trade/nope'))?.status()).toBe(404);});
  21 | test('UI503 offline clears facts and intent then explicit access recovery never replays writes',async({page,context})=>{await open(page);await select(page);await context.setOffline(true);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await expect(page.getByText(/^最后同步时间：/)).toBeVisible();await expect(current(page)).toHaveCount(0);await expect(draft(page)).toHaveCount(0);await context.setOffline(false);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();expect(networkRows().filter(r=>!r.control).every(r=>r.method==='GET')).toBe(true);});
  22 | test('UI503 actual session revocation clears reference facts immediately',async({page})=>{await open(page);await select(page);expect((await control('/v1/auth/logout',undefined,undefined,{method:'POST'})).status).toBe(204);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await expect(current(page)).toHaveCount(0);await expect(draft(page)).toHaveCount(0);});
  23 | test('UI503 loading and empty state retain permanent non-executable boundary',async({page})=>{fault({slow:true,empty:true});await page.goto('/trade');await authorized(page);await expect(page.getByText('正在读取建议列表…',{exact:true})).toBeVisible();await expect(page.getByText('当前返回的建议页为空。',{exact:true})).toBeVisible();await expect(page.getByTestId('trade-permanent')).toContainText('executable=false');expect(networkRows().every(r=>r.method==='GET')).toBe(true);});
  24 | test('UI503 dark light desktop mobile basic layout and axe keep source gaps and non-executable state visible',async({page},info)=>{await open(page);await select(page);const scans=[];for(const theme of ['dark','light']as const){await page.emulateMedia({colorScheme:theme});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await expect(page.getByTestId('trade-permanent')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const scan=await new AxeBuilder({page}).analyze();scans.push({theme,width,current:await page.getByTestId('trade-snapshot').getByRole('status').innerText(),violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath('ui503-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));expect(scan.violations).toEqual([]);await page.screenshot({path:info.outputPath(`trade-${theme}-${width}.png`),fullPage:true});}}});
  25 | 
  26 | test('UI503 Proposal entry supplies only a proposal reference and reload keeps non-executable boundary',async({page})=>{await page.goto('/proposals');await authorized(page);await page.getByRole('link',{name:'查看建议',exact:true}).first().click();const link=page.getByRole('link',{name:'预填 Trade Ticket',exact:true});await expect(link).toHaveAttribute('href',/^\/trade\?proposalId=[a-f0-9-]{36}$/);await link.click();await authorized(page);await expect(page.getByTestId('trade-permanent')).toContainText('executable=false');await expect(draft(page)).toHaveCount(0);expect(networkRows().every(r=>r.method==='GET')).toBe(true);});
  27 | 
```