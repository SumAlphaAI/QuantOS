# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p18.spec.ts >> P18 overview/detail dark/light 1672/1024/390 visual and accessibility matrix
- Location: tests/e2e/ui-p18.spec.ts:24:5

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
+               "contrastRatio": 1.79,
+               "messageKey": "fgContrast",
+               "nodeColor": "#e8eef7",
+               "parentColor": "#a7b4c8",
+               "requiredContrastRatio": 3,
+             },
+             "id": "link-in-text-block",
+             "impact": "serious",
+             "message": "The link has insufficient color contrast of 1.79:1 with the surrounding text. (Minimum contrast is 3:1, link text: #e8eef7, surrounding text: #a7b4c8)",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<nav aria-label=\"Markets 导航\"><a href=\"/markets\">Markets</a><span> / BTC/USDT</span></nav>",
+                 "target": Array [
+                   "nav[aria-label=\"Markets 导航\"]",
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
+                 "html": "<nav aria-label=\"Markets 导航\"><a href=\"/markets\">Markets</a><span> / BTC/USDT</span></nav>",
+                 "target": Array [
+                   "nav[aria-label=\"Markets 导航\"]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   The link has insufficient color contrast of 1.79:1 with the surrounding text. (Minimum contrast is 3:1, link text: #e8eef7, surrounding text: #a7b4c8)
+   The link has no styling (such as underline) to distinguish it from the surrounding text",
+         "html": "<a href=\"/markets\">Markets</a>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "nav[aria-label=\"Markets 导航\"] > a[href$=\"markets\"]",
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
  4  | import {installReferenceHooks,authorized,networkRows,fault,control} from './fixtures/ui-p18-reference';
  5  | installReferenceHooks();
  6  | const btc='binance:spot:BTC/USDT',coin='coinbase:spot:BTC/USDT',detail='/markets/BTC%2FUSDT?venue=coinbase&product=spot';
  7  | const watchWrites=()=>networkRows().filter(r=>r.method==='PUT'&&r.path==='/v1/markets/watchlist'&&!r.control),alertWrites=()=>networkRows().filter(r=>r.method==='PUT'&&r.path==='/v1/alerts/subscriptions'&&!r.control);
  8  | async function open(page:Page,path='/markets',withAlerts=true){await page.goto(path);await authorized(page);await expect(page.getByTestId('market-row')).toHaveCount(4);if(withAlerts)await expect(page.getByRole('status').filter({hasText:/告警偏好：已保存/})).toBeVisible();}
  9  | const chosen=(page:Page)=>page.getByTestId('instrument-detail');
  10 | test('P18 actual overview routes to exact instrument/venue, compares reference quotes, loads lineage and navigates back',async({page})=>{await open(page);await page.getByTestId('market-row').filter({has:page.getByLabel(`自选 ${coin}`,{exact:true})}).getByRole('link',{name:'BTC/USDT',exact:true}).click();await expect(page).toHaveURL(new RegExp('markets/BTC%2FUSDT\\?venue=coinbase&product=spot'));await expect(chosen(page)).toContainText('coinbase / spot');await expect(chosen(page)).toContainText('124');await expect(page.getByRole('table',{name:'Venue 报价比较',exact:true})).toContainText('103.90');await expect(page.getByRole('table',{name:'Venue 报价比较',exact:true})).toContainText('123.90');await expect(page.getByRole('link',{name:'查看数据血缘快照',exact:true})).toHaveAttribute('href',/^\/data-snapshots\/[a-f0-9-]{36}$/);await expect(page.getByRole('button',{name:'打开交易单',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'查看 K 线',exact:true})).toBeDisabled();await page.reload();await authorized(page);await expect(chosen(page)).toContainText('coinbase / spot');await page.getByRole('navigation',{name:'Markets 导航'}).getByRole('link',{name:'Markets',exact:true}).click();await expect(page).toHaveURL(/\/markets$/);await page.goBack();await expect(chosen(page)).toContainText('coinbase / spot');expect(networkRows().some(r=>r.method==='POST')).toBe(false);});
  11 | test('P18 self watchlist writes persist and all filters/empty guidance stay API-backed',async({page})=>{await open(page);await page.getByLabel(`自选 ${btc}`,{exact:true}).check();await page.getByRole('button',{name:'保存自选',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'已保存 · objectVersion：watchlist-'})).toBeVisible();await page.getByRole('button',{name:/^自选 1$/}).click();await expect(page.getByTestId('market-row')).toHaveCount(1);await page.getByLabel('搜索标的',{exact:true}).fill('none');await expect(page.getByText('当前筛选没有可见市场。请清除筛选或添加自选。',{exact:true})).toBeVisible();await page.getByRole('button',{name:'清除筛选',exact:true}).click();await expect(page.getByTestId('market-row')).toHaveCount(4);await page.reload();await authorized(page);await expect(page.getByLabel(`自选 ${btc}`,{exact:true})).toBeChecked();expect(watchWrites()).toHaveLength(1);});
  12 | test('P18 lost watchlist response locks original key/body/version and explicit retry recovers once',async({page})=>{await open(page);await page.getByLabel(`自选 ${btc}`,{exact:true}).check();fault({drop:true});await page.getByRole('button',{name:'保存自选',exact:true}).click();await expect(page.getByRole('button',{name:'重试原自选请求',exact:true})).toBeEnabled();await expect(page.getByLabel(`自选 ${btc}`,{exact:true})).toBeDisabled();await page.getByRole('button',{name:'重试原自选请求',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'已保存 · objectVersion：watchlist-'})).toBeVisible();const rows=watchWrites();expect(rows).toHaveLength(2);for(const key of ['keyHash','bodyHash','version','responseHash'] as const)expect(rows[0][key]).toBe(rows[1][key]);});
  13 | test('P18 self watchlist 409 keeps local edits and requires explicit latest-version review',async({page})=>{await open(page);await page.getByLabel(`自选 ${btc}`,{exact:true}).check();const competing=await control('/v1/markets/watchlist',{instrumentIds:[coin]},'watchlist-0');expect(competing.status).toBe(200);await page.getByRole('button',{name:'保存自选',exact:true}).click();await expect(page.getByRole('region',{name:'自选冲突',exact:true})).toBeVisible();await page.getByRole('button',{name:'读取冲突版本',exact:true}).click();await expect(page.getByRole('button',{name:'保留本地选择并重新审阅',exact:true})).toBeVisible();await page.getByRole('button',{name:'保留本地选择并重新审阅',exact:true}).click();expect(watchWrites()).toHaveLength(1);await page.getByRole('button',{name:'保存自选',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'已保存 · objectVersion：watchlist-'})).toBeVisible();expect(watchWrites()[1].version).toBe(competing.body.objectVersion);});
  14 | test('P18 C16 market subscription preserves all other domains and severities after saved reload',async({page},info)=>{await open(page,detail);const before=await control('/v1/alerts/subscriptions');await page.getByLabel('订阅市场告警',{exact:true}).uncheck();await page.getByRole('button',{name:'保存市场告警偏好',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'告警偏好：已保存 · v1'})).toBeVisible();const after=await control('/v1/alerts/subscriptions');expect(after.body.domains).toEqual((before.body.domains as string[]).filter(d=>d!=='market'));expect(after.body.severities).toEqual(before.body.severities);await page.reload();await authorized(page);await expect(page.getByLabel('订阅市场告警',{exact:true})).not.toBeChecked();expect(alertWrites()).toHaveLength(1);await writeFile(info.outputPath('subscriptions.json'),JSON.stringify({before:before.body,after:after.body},null,2));});
  15 | test('P18 lost C16 reply reuses the exact committed subscription intent',async({page})=>{await open(page);await page.getByLabel('订阅市场告警',{exact:true}).uncheck();fault({drop:true});await page.getByRole('button',{name:'保存市场告警偏好',exact:true}).click();await expect(page.getByRole('button',{name:'重试原告警偏好请求',exact:true})).toBeEnabled();await expect(page.getByLabel('订阅市场告警',{exact:true})).toBeDisabled();await page.getByRole('button',{name:'重试原告警偏好请求',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'告警偏好：已保存 · v1'})).toBeVisible();const rows=alertWrites();expect(rows).toHaveLength(2);for(const key of ['keyHash','bodyHash','version','responseHash'] as const)expect(rows[0][key]).toBe(rows[1][key]);});
  16 | test('P18 C16 conflict explicitly rebases market choice onto latest unrelated preferences',async({page})=>{await open(page);await page.getByLabel('订阅市场告警',{exact:true}).uncheck();const other=await control('/v1/alerts/subscriptions',{domains:['order','market'],severities:['info']},'0');expect(other.status).toBe(200);await page.getByRole('button',{name:'保存市场告警偏好',exact:true}).click();await expect(page.getByRole('region',{name:'告警偏好冲突',exact:true})).toBeVisible();await page.getByRole('button',{name:'读取告警冲突版本',exact:true}).click();await page.getByRole('button',{name:'基于最新偏好保留市场选择',exact:true}).click();expect(alertWrites()).toHaveLength(1);await page.getByRole('button',{name:'保存市场告警偏好',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'告警偏好：已保存 · v2'})).toBeVisible();const saved=await control('/v1/alerts/subscriptions');expect(saved.body.domains).toEqual(['order']);expect(saved.body.severities).toEqual(['info']);});
  17 | test('P18 per-venue failure keeps other quotes readable and an unlicensed selection has no price context',async({page})=>{await page.route('**/v1/markets/quotes?**',async route=>{const u=new URL(route.request().url());if(u.searchParams.get('venue')==='coinbase'){await route.fulfill({status:403,json:{code:'FORBIDDEN',message:'private SQL',correlationId:'11111111-1111-4111-8111-111111111111'}});return;}await route.continue();});await open(page,detail);await expect(page.getByRole('table',{name:'市场目录',exact:true})).toContainText('报价许可受限');await expect(page.getByRole('table',{name:'市场目录',exact:true})).toContainText('103.90');await expect(chosen(page).locator('.p18-price')).toContainText('—');await expect(page.getByRole('link',{name:'查看数据血缘快照',exact:true})).toHaveCount(0);await expect(page.getByLabel(`自选 ${coin}`,{exact:true})).toBeDisabled();await expect(page.locator('main')).not.toContainText('private SQL');});
  18 | test('P18 wrong-dimension source response is isolated without leaking its price into detail',async({page})=>{await page.route('**/v1/markets/quotes?**',async route=>{const r=await route.fetch(),body=await r.json();if(new URL(route.request().url()).searchParams.get('venue')==='coinbase')body.items[0].provenance.venue='binance';await route.fulfill({response:r,json:body});});await open(page,detail);await expect(page.getByRole('table',{name:'市场目录',exact:true})).toContainText('行情源不可用 (502)');await expect(page.getByRole('link',{name:'查看数据血缘快照',exact:true})).toHaveCount(0);expect(networkRows().some(r=>r.method==='PUT')).toBe(false);});
  19 | test('P18 readonly viewer cannot change watchlist; C16 remains a scoped personal preference contract',async({page})=>{fault({readonly:true});await open(page,'/markets',false);await expect(page.getByText('当前无 alerts.read，告警偏好不可用。',{exact:true})).toBeVisible();await expect(page.getByText('当前身份自选只读',{exact:true})).toBeVisible();await expect(page.getByLabel(`自选 ${btc}`,{exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'保存自选',exact:true})).toBeDisabled();expect(watchWrites()).toHaveLength(0);});
  20 | test('P18 offline clears quotes, subscription drafts and stream then explicit recovery only reads',async({page})=>{await open(page,detail);await page.getByLabel(`自选 ${btc}`,{exact:true}).check();await page.getByLabel('订阅市场告警',{exact:true}).uncheck();await page.evaluate(()=>dispatchEvent(new Event('offline')));await expect(page.getByRole('heading',{name:'Market 访问条件已变化'})).toBeVisible();await expect(page.getByTestId('instrument-detail')).toHaveCount(0);await expect(page.getByText(/最后报价同步/)).toBeVisible();await page.getByRole('button',{name:'重新核对访问权限',exact:true}).click();await authorized(page);await expect(page.getByLabel(`自选 ${btc}`,{exact:true})).not.toBeChecked();await expect(page.getByLabel('订阅市场告警',{exact:true})).toBeChecked();expect(watchWrites()).toHaveLength(0);expect(alertWrites()).toHaveLength(0);});
  21 | test('P18 saved filters/layout persist only UI preferences, and recent visits stay in memory',async({page})=>{await open(page);await page.getByLabel('搜索标的',{exact:true}).fill('ETH');await page.getByLabel('Venue',{exact:true}).selectOption('coinbase');await page.getByRole('button',{name:'列布局',exact:true}).click();await page.getByLabel('密度',{exact:true}).selectOption('compact');await page.getByRole('button',{name:'保存筛选',exact:true}).click();const storage=await page.evaluate(()=>JSON.parse(localStorage.getItem('quantos.p18.view.v1')!));expect(Object.keys(storage).sort()).toEqual(['search','venue','currency','quality','tab','density','provenance'].sort());await page.reload();await authorized(page);await expect(page.getByLabel('搜索标的',{exact:true})).toHaveValue('ETH');await expect(page.getByTestId('market-row')).toHaveCount(1);await page.getByRole('button',{name:'清除筛选',exact:true}).click();await page.getByTestId('market-row').first().getByRole('link').click();await page.getByRole('button',{name:/^最近访问 1$/}).click();await expect(page.getByTestId('market-row')).toHaveCount(1);expect(networkRows().some(r=>r.method==='PUT')).toBe(false);});
  22 | test('P18 empty catalog, unknown symbol and malformed paths stay closed without fake prices',async({page})=>{fault({empty:true});await page.goto('/markets');await authorized(page);await expect(page.getByText('当前筛选没有可见市场。请清除筛选或添加自选。',{exact:true})).toBeVisible();fault({});await open(page,'/markets/UNKNOWN%2FUSDT?venue=binance&product=spot');await expect(chosen(page)).toContainText('目录未返回对应授权标的');await expect(page.getByRole('link',{name:'查看数据血缘快照',exact:true})).toHaveCount(0);const before=networkRows().length;await page.goto('/markets/BTC%2FUSDT?venue=binance&product=perpetual');await expect(page.getByRole('heading',{name:'Market 引用无效'})).toBeVisible();expect(networkRows()).toHaveLength(before);const r=await page.goto('/markets/BTC/USDT');expect(r?.status()).toBe(404);});
  23 | test('P18 selected quote feed disconnect freezes last fact; explicit resume binds its cursor',async({page})=>{await open(page,detail);await expect(chosen(page).getByRole('status')).toContainText('报价流：disconnected');await page.getByRole('button',{name:'重连选中报价',exact:true}).click();await expect(chosen(page).getByRole('status')).toContainText('报价流：disconnected');const streams=networkRows().filter(r=>r.path==='/v1/markets/quotes/stream');expect(streams.length).toBeGreaterThanOrEqual(2);await expect(chosen(page)).toContainText('coinbase / spot');expect(watchWrites()).toHaveLength(0);});
> 24 | test('P18 overview/detail dark/light 1672/1024/390 visual and accessibility matrix',async({page},info)=>{const scans=[],geometry=[];for(const path of ['/markets',detail]){await open(page,path);for(const theme of ['dark','light'] as const){await page.emulateMedia({colorScheme:theme});for(const width of [1672,1024,390]){await page.setViewportSize({width,height:1000});await page.locator('main').evaluate(el=>{el.scrollTop=0;});await expect(chosen(page)).toBeAttached();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const a=await new AxeBuilder({page}).analyze();scans.push({path,theme,width,violations:a.violations,incomplete:a.incomplete});await writeFile(info.outputPath('p18-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));expect(a.violations).toEqual([]);expect(a.incomplete.some(r=>r.id==='aria-prohibited-attr')).toBe(false);geometry.push({path,theme,width,watch:await page.getByRole('complementary',{name:'自选市场',exact:true}).boundingBox(),market:await page.getByRole('region',{name:'市场目录工作区',exact:true}).boundingBox(),detail:await chosen(page).boundingBox()});if(path!=='/markets'&&width<=1024)await chosen(page).scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`p18-${path==='/markets'?'overview':'detail'}-${theme}-${width}.png`),fullPage:true});}}}await writeFile(info.outputPath('p18-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));await writeFile(info.outputPath('p18-geometry.json'),JSON.stringify(geometry,null,2));});
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               ^ Error: expect(received).toEqual(expected) // deep equality
  25 | 
```