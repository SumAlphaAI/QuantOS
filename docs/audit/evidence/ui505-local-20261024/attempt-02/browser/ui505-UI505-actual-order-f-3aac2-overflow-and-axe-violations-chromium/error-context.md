# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui505.spec.ts >> UI505 actual order facts desktop/mobile light/dark have no overflow and axe violations
- Location: tests/e2e/ui505.spec.ts:17:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 70

- Array []
+ Array [
+   Object {
+     "description": "Ensure links are distinguished from surrounding text in a way that does not rely on color",
+     "help": "Links must be distinguishable without relying on color",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.13/link-in-text-block?application=playwright",
+     "id": "link-in-text-block",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "contrastRatio": 1.68,
+               "messageKey": "fgContrast",
+               "nodeColor": "#31c8f4",
+               "parentColor": "#e8eef7",
+               "requiredContrastRatio": 3,
+             },
+             "id": "link-in-text-block",
+             "impact": "serious",
+             "message": "The link has insufficient color contrast of 1.68:1 with the surrounding text. (Minimum contrast is 3:1, link text: #31c8f4, surrounding text: #e8eef7)",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<li><a href=\"/orders/21fd8397-c31c-4851-af30-4a91151e61c0\">查看订单 21fd8397-c31c-4851-af30-4a91151e61c0</a> · BTCUSDT / buy / accepted · Filled 0 / 1500</li>",
+                 "target": Array [
+                   "ul > li",
+                 ],
+               },
+             ],
+           },
+           Object {
+             "data": null,
+             "id": "link-in-text-block-style",
+             "impact": "serious",
+             "message": "The link has no styling (such as underline) to distinguish it from the surrounding text",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<li><a href=\"/orders/21fd8397-c31c-4851-af30-4a91151e61c0\">查看订单 21fd8397-c31c-4851-af30-4a91151e61c0</a> · BTCUSDT / buy / accepted · Filled 0 / 1500</li>",
+                 "target": Array [
+                   "ul > li",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   The link has insufficient color contrast of 1.68:1 with the surrounding text. (Minimum contrast is 3:1, link text: #31c8f4, surrounding text: #e8eef7)
+   The link has no styling (such as underline) to distinguish it from the surrounding text",
+         "html": "<a href=\"/orders/21fd8397-c31c-4851-af30-4a91151e61c0\">查看订单 21fd8397-c31c-4851-af30-4a91151e61c0</a>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "li > a",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.color",
+       "wcag2a",
+       "wcag141",
+       "TTv5",
+       "TT13.a",
+       "EN-301-549",
+       "EN-9.1.4.1",
+       "RGAAv4",
+       "RGAA-10.6.1",
+     ],
+   },
+ ]
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import {writeFile} from 'node:fs/promises';
  4  | import {installReferenceHooks,authorized,networkRows,fault,control} from './fixtures/ui505-reference';
  5  | installReferenceHooks();
  6  | const facts=(p:Page)=>p.getByTestId('order-facts'),receipt=(p:Page)=>p.getByRole('region',{name:'操作受理回执',exact:true}),errors=(p:Page)=>p.locator('.orders-workspace > [role=alert]');
  7  | async function seed(){const p=((await control('/v1/proposals')).body.items as Record<string,unknown>[])[0],q=await control(`/v1/trade-preflight?accountId=${p.accountId}&proposalId=${p.proposalId}`);expect((await control(`/v1/proposals/${p.proposalId}/risk-evaluations`,{contextHash:q.body.contextHash},String(p.objectVersion),{method:'POST'})).status).toBe(202);const a=((await control('/v1/approvals')).body.items as Record<string,unknown>[]).find(a=>a.correlationId===p.correlationId)!;const opts={method:'POST' as const,session:'session-approver' as const},m=await control('/v1/auth/mfa/challenges',{purpose:'security_change',code:'123456'},undefined,opts),r=await control('/v1/auth/reauth',{challengeRef:m.body.challengeRef},undefined,opts);expect((await control(`/v1/approvals/${a.approvalId}/decisions`,{decision:'approve',mfaChallengeRef:m.body.challengeRef,reauthTokenRef:r.body.reauthTokenRef},String(a.objectVersion),opts)).status).toBe(200);return String(a.approvalId);}
  8  | async function open(p:Page){await p.goto('/orders?approvalId='+await seed());await authorized(p);await expect(p.getByTestId('command-review')).toBeVisible();}
  9  | async function confirm(p:Page,action:'submit'|'cancel'){await p.getByRole('button',{name:action==='submit'?'提交服务端 Command':'请求撤单',exact:true}).click();const d=p.getByRole('dialog');await expect(d.getByRole('button',{name:'取消',exact:true})).toBeFocused();const phrase=action==='submit'?'SUBMIT COMMAND':'CANCEL ORDER';await d.getByLabel('输入“'+phrase+'”以确认').fill(phrase);await d.getByRole('button',{name:action==='submit'?'确认提交 Command':'确认撤单请求',exact:true}).click();}
  10 | const writes=()=>networkRows().filter(r=>!r.control&&r.method==='POST');
  11 | test('UI505 actual submit and cancel use server refs, actual dense facts and terminal reload',async({page})=>{await open(page);await expect(facts(page)).toHaveCount(0);await confirm(page,'submit');await expect(receipt(page)).toContainText('不是成交');await expect(facts(page)).toContainText('accepted');await expect(facts(page)).toContainText('没有已确认成交事实');expect(writes()).toHaveLength(1);await confirm(page,'cancel');await expect(facts(page)).toContainText('cancelled');await expect(page.getByRole('region',{name:'Order Fill 时间线'})).toContainText('#1 · accepted');await expect(page.getByRole('region',{name:'Order Fill 时间线'})).toContainText('#2 · cancelled');expect(writes()).toHaveLength(2);await expect(page.getByRole('button',{name:'请求撤单',exact:true})).toBeDisabled();await page.getByRole('link',{name:/查看订单 /}).click();await page.reload();await authorized(page);await expect(facts(page)).toContainText('cancelled');expect(writes()).toHaveLength(2);});
  12 | for(const action of ['submit','cancel']as const)test('UI505 committed lost '+action+' recovers exact original key/body only after explicit action',async({page})=>{await open(page);if(action==='cancel'){await confirm(page,'submit');await expect(facts(page)).toContainText('accepted');}fault({drop:true});await confirm(page,action);await expect(page.getByRole('region',{name:'未知结果',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'恢复原请求',exact:true})).toBeEnabled();await page.getByRole('button',{name:'恢复原请求',exact:true}).click();await expect(facts(page)).toContainText(action==='submit'?'accepted':'cancelled');const rows=writes().filter(r=>action==='submit'?r.path==='/v1/commands':r.path.endsWith('/cancel-requests'));expect(rows).toHaveLength(2);expect(rows[0].keyHash).toBe(rows[1].keyHash);expect(rows[0].bodyHash).toBe(rows[1].bodyHash);await expect(page.getByRole('region',{name:'未知结果',exact:true})).toHaveCount(0);});
  13 | test('UI505 expired source and approver identity cannot submit',async({page})=>{const id=await seed();fault({expired:true});await page.goto('/orders?approvalId='+id);await authorized(page);await expect(errors(page)).toBeVisible();await expect(page.getByTestId('command-review')).toHaveCount(0);fault({actor:'session-approver'});await page.reload();await authorized(page);await expect(errors(page)).toBeVisible();expect(writes()).toHaveLength(0);});
  14 | test('UI505 explicit confirmation cancel and Escape never write; known conflict never acknowledges',async({page})=>{await open(page);await page.getByRole('button',{name:'提交服务端 Command',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);expect(writes()).toHaveLength(0);fault({conflict:true});await confirm(page,'submit');await expect(errors(page)).toContainText('拒绝');await expect(receipt(page)).toHaveCount(0);await expect(facts(page)).toHaveCount(0);await expect(page.getByRole('region',{name:'未知结果',exact:true})).toHaveCount(0);expect(writes()).toHaveLength(1);});
  15 | test('UI505 empty/loading, bounded 429 and invalid references remain read only',async({page})=>{fault({empty:true,slow:true});await page.goto('/orders');await authorized(page);await expect(page.getByText('正在读取订单…',{exact:true})).toBeVisible();await expect(page.getByText('当前授权的订单页为空。',{exact:true})).toBeVisible();fault({rateLimit:true});await page.getByRole('button',{name:'刷新订单列表',exact:true}).click();await expect(errors(page)).toContainText('冷却');await expect(page.getByText('private SQL',{exact:false})).toHaveCount(0);await expect(page.getByRole('button',{name:'刷新订单列表',exact:true})).toBeDisabled();const count=networkRows().length;await page.goto('/orders?commandRef=forged');await expect(page.getByRole('heading',{name:'Orders 引用无效',exact:true})).toBeVisible();expect(networkRows()).toHaveLength(count);expect((await page.goto('/orders/nope'))?.status()).toBe(404);expect(writes()).toHaveLength(0);});
  16 | test('UI505 actual logout and offline wipe facts and unknown intents',async({page,context})=>{await open(page);await confirm(page,'submit');await expect(facts(page)).toContainText('accepted');await context.setOffline(true);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await expect(facts(page)).toHaveCount(0);await context.setOffline(false);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await page.reload();await authorized(page);expect((await control('/v1/auth/logout',undefined,undefined,{method:'POST'})).status).toBe(204);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();});
> 17 | test('UI505 actual order facts desktop/mobile light/dark have no overflow and axe violations',async({page},info)=>{await open(page);await confirm(page,'submit');await expect(facts(page)).toContainText('accepted');const scans=[];for(const theme of ['dark','light']as const){await page.emulateMedia({colorScheme:theme});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const scan=await new AxeBuilder({page}).analyze();scans.push({theme,width,violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath('ui505-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));expect(scan.violations).toEqual([]);await page.screenshot({path:info.outputPath(`orders-${theme}-${width}.png`),fullPage:true});}}});
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                ^ Error: expect(received).toEqual(expected) // deep equality
  18 | 
```