# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: native-kill-control.spec.ts >> public native kill UI preserves original intent and joins independent release C10
- Location: tests/e2e/native-kill-control.spec.ts:7:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 166

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
+               "contrastRatio": 1.4,
+               "messageKey": "fgContrast",
+               "nodeColor": "#75dcff",
+               "parentColor": "#edf3ff",
+               "requiredContrastRatio": 3,
+             },
+             "id": "link-in-text-block",
+             "impact": "serious",
+             "message": "The link has insufficient color contrast of 1.4:1 with the surrounding text. (Minimum contrast is 3:1, link text: #75dcff, surrounding text: #edf3ff)",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<li>engage · account · Generation 1 · owned browser stop review <a href=\"/audit?correlationId=01a1864a-0731-7271-833c-d0f6773532b8\">查看停止审计</a></li>",
+                 "target": Array [
+                   "li:nth-child(1)",
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
+                 "html": "<li>engage · account · Generation 1 · owned browser stop review <a href=\"/audit?correlationId=01a1864a-0731-7271-833c-d0f6773532b8\">查看停止审计</a></li>",
+                 "target": Array [
+                   "li:nth-child(1)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   The link has insufficient color contrast of 1.4:1 with the surrounding text. (Minimum contrast is 3:1, link text: #75dcff, surrounding text: #edf3ff)
+   The link has no styling (such as underline) to distinguish it from the surrounding text",
+         "html": "<a href=\"/audit?correlationId=01a1864a-0731-7271-833c-d0f6773532b8\">查看停止审计</a>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "li:nth-child(1) > a",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "contrastRatio": 1.4,
+               "messageKey": "fgContrast",
+               "nodeColor": "#75dcff",
+               "parentColor": "#edf3ff",
+               "requiredContrastRatio": 3,
+             },
+             "id": "link-in-text-block",
+             "impact": "serious",
+             "message": "The link has insufficient color contrast of 1.4:1 with the surrounding text. (Minimum contrast is 3:1, link text: #75dcff, surrounding text: #edf3ff)",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<li>approve_release · account · Generation 1 · independent browser release review <a href=\"/audit?correlationId=01a1864a-0731-7271-833c-d0f6773532b8\">查看停止审计</a></li>",
+                 "target": Array [
+                   "li:nth-child(2)",
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
+                 "html": "<li>approve_release · account · Generation 1 · independent browser release review <a href=\"/audit?correlationId=01a1864a-0731-7271-833c-d0f6773532b8\">查看停止审计</a></li>",
+                 "target": Array [
+                   "li:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   The link has insufficient color contrast of 1.4:1 with the surrounding text. (Minimum contrast is 3:1, link text: #75dcff, surrounding text: #edf3ff)
+   The link has no styling (such as underline) to distinguish it from the surrounding text",
+         "html": "<a href=\"/audit?correlationId=01a1864a-0731-7271-833c-d0f6773532b8\">查看停止审计</a>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "li:nth-child(2) > a",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "contrastRatio": 1.4,
+               "messageKey": "fgContrast",
+               "nodeColor": "#75dcff",
+               "parentColor": "#edf3ff",
+               "requiredContrastRatio": 3,
+             },
+             "id": "link-in-text-block",
+             "impact": "serious",
+             "message": "The link has insufficient color contrast of 1.4:1 with the surrounding text. (Minimum contrast is 3:1, link text: #75dcff, surrounding text: #edf3ff)",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<li>release · account · Generation 2 · owner explicit release <a href=\"/audit?correlationId=01a1864a-0731-7271-833c-d0f6773532b8\">查看停止审计</a></li>",
+                 "target": Array [
+                   "li:nth-child(3)",
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
+                 "html": "<li>release · account · Generation 2 · owner explicit release <a href=\"/audit?correlationId=01a1864a-0731-7271-833c-d0f6773532b8\">查看停止审计</a></li>",
+                 "target": Array [
+                   "li:nth-child(3)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   The link has insufficient color contrast of 1.4:1 with the surrounding text. (Minimum contrast is 3:1, link text: #75dcff, surrounding text: #edf3ff)
+   The link has no styling (such as underline) to distinguish it from the surrounding text",
+         "html": "<a href=\"/audit?correlationId=01a1864a-0731-7271-833c-d0f6773532b8\">查看停止审计</a>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "li:nth-child(3) > a",
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

```
Error: page.screenshot: Target page, context or browser has been closed
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import {writeFile} from 'node:fs/promises';
  4  | import {installReferenceHooks,useSession,authorized,control,fault,networkRows,zoneSnapshot} from './fixtures/frontend-g8-reference';
  5  | installReferenceHooks('assisted-mtls-local');
> 6  | test.afterEach(async({page},info)=>{await writeFile(info.outputPath('native-control-network.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,rows:networkRows()},null,2));if(info.status!=='passed')await page.screenshot({path:info.outputPath('native-control-failure.png'),fullPage:true});});
     |                                                                                                                                                                                                                          ^ Error: page.screenshot: Target page, context or browser has been closed
  7  | test('public native kill UI preserves original intent and joins independent release C10',async({page},info)=>{
  8  |  useSession('session-current');await page.goto('/orders');await authorized(page);
  9  |  const panel=page.getByTestId('native-kill-control');await expect(panel.getByTestId('native-kill-state')).toContainText('Generation 0');
  10 |  await panel.getByLabel('停止控制原因',{exact:true}).fill('owned browser stop review');await panel.getByRole('button',{name:'确认停止',exact:true}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel('输入“ENGAGE ACCOUNT KILL”以确认').fill('ENGAGE ACCOUNT KILL');await dialog.getByLabel('MFA 验证码',{exact:true}).fill('123456');fault({dropPath:'/v1/risk/kill-switch/engage'});await dialog.getByRole('button',{name:'验证并提交停止控制',exact:true}).click();await expect(panel).toContainText('停止操作结果未知');await panel.getByRole('button',{name:'恢复原停止请求',exact:true}).click();await expect(panel.getByTestId('native-kill-state')).toContainText('Generation 1');await expect(panel.getByTestId('native-kill-state')).toContainText('原生 已停止');
  11 |  useSession('session-approver');await page.goto('/orders');await authorized(page);await expect(panel.getByTestId('native-kill-state')).toContainText('Generation 1');await panel.getByLabel('停止控制原因',{exact:true}).fill('independent browser release review');await panel.getByRole('button',{name:'独立复核解除',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('输入“APPROVE ACCOUNT RELEASE”以确认').fill('APPROVE ACCOUNT RELEASE');await dialog.getByLabel('MFA 验证码',{exact:true}).fill('123456');await dialog.getByRole('button',{name:'验证并提交停止控制',exact:true}).click();await expect(panel.getByLabel('独立解除复核',{exact:true}).locator('option')).toHaveCount(2);
  12 |  useSession('session-owner');await page.goto('/orders');await authorized(page);await expect(panel.getByLabel('独立解除复核',{exact:true}).locator('option')).toHaveCount(2);await panel.getByLabel('独立解除复核',{exact:true}).selectOption({index:1});await panel.getByLabel('停止控制原因',{exact:true}).fill('owner explicit release');await panel.getByRole('button',{name:'Owner 解除停止',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('输入“RELEASE ACCOUNT KILL”以确认').fill('RELEASE ACCOUNT KILL');await dialog.getByLabel('MFA 验证码',{exact:true}).fill('123456');await dialog.getByRole('button',{name:'验证并提交停止控制',exact:true}).click();await expect(panel.getByTestId('native-kill-state')).toContainText('Generation 2');await expect(panel.getByTestId('native-kill-state')).toContainText('原生 未停止');
  13 |  const current=await control('/v1/risk/kill-switch',undefined,undefined,{session:'session-owner'});expect(current.body.nativeGeneration).toBe('2');expect(current.body.unknownCommands).toBe(0);const history=current.body.history as {correlationId:string}[];expect(history).toHaveLength(3);const chain=await control('/v1/audit/evidence-chains/'+history[0].correlationId,undefined,undefined,{session:'session-owner'});expect(chain.body.items).toHaveLength(3);
  14 |  const pair=networkRows().filter(r=>!r.control&&r.path==='/v1/risk/kill-switch/engage'&&r.method==='POST');expect(pair).toHaveLength(2);expect(pair[0].keyHash).toBe(pair[1].keyHash);expect(pair[0].bodyHash).toBe(pair[1].bodyHash);expect(zoneSnapshot()?.protocolCalls).toBe(0);
  15 |  const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([]);await writeFile(info.outputPath('native-control-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,violations:axe.violations,incomplete:axe.incomplete,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));await page.screenshot({path:info.outputPath('native-control.png'),fullPage:true});
  16 |  await panel.getByRole('link',{name:'查看停止审计',exact:true}).first().click();await authorized(page);await expect(page.locator('main')).toContainText('assisted.kill_release');
  17 |  await writeFile(info.outputPath('native-control-browser.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,current:current.body,chain:chain.body,originalPair:pair.map(({keyHash,...r})=>({...r,idempotencyDigest:keyHash})),protocolCalls:0,actualTestnet:false,independentRelease:true},null,2));
  18 | });
  19 | 
```