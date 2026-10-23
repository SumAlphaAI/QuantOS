# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui401.spec.ts >> catalog error, explicit read retry and empty state do not fabricate prices
- Location: tests/e2e/ui401.spec.ts:19:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('alert')
Expected substring: "Market 请求未完成"
Error: strict mode violation: getByRole('alert') resolved to 2 elements:
    1) <p role="alert">Market 请求未完成，请核对状态后显式重试。 关联 ID：aaaaaaaa-1111-4111…</p> aka getByText('Market 请求未完成，请核对状态后显式重试。 关联')
    2) <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div> aka locator('[id="__next-route-announcer__"]')

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByRole('alert')

```

# Test source

```ts
  1  | import {test,expect,type Page} from "@playwright/test";
  2  | import AxeBuilder from "@axe-core/playwright";
  3  | import {writeFile} from "node:fs/promises";
  4  | import {installReferenceHooks,authorized,networkRows,fault,control} from "./fixtures/ui401-reference";
  5  | installReferenceHooks();
  6  | const ids=['binance:spot:BTC/USDT','binance:spot:ETH/USDT','coinbase:spot:BTC/USDT','coinbase:spot:ETH/USDT'];
  7  | async function open(page:Page){await page.goto('/markets');await authorized(page);await expect(page.getByTestId('market-row')).toHaveCount(4);}
  8  | const putRows=()=>networkRows().filter(r=>r.method==='PUT'&&!r.control);
  9  | test('C12 catalog, venue/product provenance, filters, saved watchlist and persisted reload',async({page},info)=>{
  10 |  await open(page);for(const row of await page.getByTestId('market-row').all()){for(const label of ['source','venue / product','asOf','latency','quality','capability','许可 / 审批','snapshot'])await expect(row.getByText(label,{exact:true})).toBeVisible();await expect(row).toContainText('spot');await expect(row).toContainText('不可执行');}
  11 |  const bids=await page.getByTestId('market-row').allTextContents();expect(bids.filter(s=>s.includes('BTC/USDT'))).toHaveLength(2);
  12 |  await page.getByLabel('搜索标的',{exact:true}).fill('BTC');await expect(page.getByTestId('market-row')).toHaveCount(2);await page.getByLabel('Venue',{exact:true}).selectOption('coinbase');await expect(page.getByTestId('market-row')).toHaveCount(1);await page.getByLabel(`自选 ${ids[2]}`,{exact:true}).check();await page.getByRole('button',{name:'保存自选',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'已保存 · objectVersion：watchlist-'})).toBeVisible();await expect(page.getByRole('link',{name:/^[a-f0-9-]{36}$/})).toBeVisible();expect(putRows()).toHaveLength(1);await page.reload();await authorized(page);await expect(page.getByLabel(`自选 ${ids[2]}`,{exact:true})).toBeChecked();await page.getByLabel('仅自选',{exact:true}).check();await expect(page.getByTestId('market-row')).toHaveCount(1);await page.getByLabel('搜索标的',{exact:true}).fill('no-such-market');await expect(page.getByText('当前筛选没有可见市场。',{exact:true})).toBeVisible();expect(putRows()).toHaveLength(1);await writeFile(info.outputPath('c12-network.json'),JSON.stringify(networkRows(),null,2));
  13 | });
  14 | test('lost save retries exact key, body and version with one server result',async({page})=>{await open(page);await page.getByLabel(`自选 ${ids[0]}`,{exact:true}).check();fault({drop:true});await page.getByRole('button',{name:'保存自选',exact:true}).click();await expect(page.getByRole('button',{name:'重试原自选请求',exact:true})).toBeEnabled();await expect(page.getByLabel(`自选 ${ids[0]}`,{exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'刷新市场与自选',exact:true})).toBeDisabled();await page.getByRole('button',{name:'重试原自选请求',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'已保存 · objectVersion：watchlist-'})).toBeVisible();const rows=putRows();expect(rows).toHaveLength(2);for(const key of ['keyHash','bodyHash','version','responseHash'] as const)expect(rows[0][key]).toBe(rows[1][key]);});
  15 | test('409 preserves local choices; explicit head read and resolution never auto writes',async({page})=>{await open(page);await page.getByLabel(`自选 ${ids[0]}`,{exact:true}).check();const result=await control('/v1/markets/watchlist',{instrumentIds:[ids[2]]},'watchlist-0');expect(result.status).toBe(200);await page.getByRole('button',{name:'保存自选',exact:true}).click();await expect(page.getByRole('region',{name:'自选冲突'})).toBeVisible();expect(putRows()).toHaveLength(1);await page.getByRole('button',{name:'读取冲突版本',exact:true}).click();await expect(page.getByText(`服务端 ${result.body.objectVersion}：${ids[2]}`,{exact:true})).toBeVisible();await page.getByRole('button',{name:'保留本地选择并重新审阅',exact:true}).click();expect(putRows()).toHaveLength(1);await expect(page.getByLabel(`自选 ${ids[0]}`,{exact:true})).toBeChecked();await page.getByRole('button',{name:'保存自选',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'已保存 · objectVersion：watchlist-'})).toBeVisible();expect(putRows()).toHaveLength(2);expect(putRows()[1].version).toBe(result.body.objectVersion);});
  16 | test('read-only C01 viewer sees quotes, isolated watchlist and cannot write',async({page})=>{fault({readonly:true});await open(page);await expect(page.getByText('当前身份只读',{exact:true})).toBeVisible();await expect(page.getByLabel(`自选 ${ids[0]}`,{exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'保存自选',exact:true})).toBeDisabled();expect(putRows()).toHaveLength(0);});
  17 | test('offline invalidates data and dirty selection; explicit recovery only reads',async({page})=>{await open(page);await page.getByLabel(`自选 ${ids[0]}`,{exact:true}).check();await page.evaluate(()=>dispatchEvent(new Event('offline')));await expect(page.getByRole('heading',{name:'Market 访问条件已变化'})).toBeVisible();await expect(page.getByTestId('market-row')).toHaveCount(0);await page.getByRole('button',{name:'重新核对访问权限'}).click();await authorized(page);await expect(page.getByTestId('market-row')).toHaveCount(4);await expect(page.getByLabel(`自选 ${ids[0]}`,{exact:true})).not.toBeChecked();expect(putRows()).toHaveLength(0);});
  18 | test('422 displays safe error and keeps dirty selections without retry',async({page})=>{await open(page);await page.getByLabel(`自选 ${ids[0]}`,{exact:true}).check();fault({invalid:true});await page.getByRole('button',{name:'保存自选',exact:true}).click();await expect(page.getByRole('alert')).toContainText('服务端拒绝当前选择');await expect(page.locator('main')).not.toContainText('private SQL');await expect(page.getByLabel(`自选 ${ids[0]}`,{exact:true})).toBeChecked();expect(putRows()).toHaveLength(1);});
> 19 | test('catalog error, explicit read retry and empty state do not fabricate prices',async({page})=>{fault({listError:true});await page.goto('/markets');await authorized(page);await expect(page.getByRole('alert')).toContainText('Market 请求未完成');await expect(page.getByTestId('market-row')).toHaveCount(0);fault({empty:true});await page.getByRole('button',{name:'刷新市场与自选',exact:true}).click();await expect(page.getByText('当前筛选没有可见市场。',{exact:true})).toBeVisible();await expect(page.getByTestId('market-row')).toHaveCount(0);fault({});await page.getByRole('button',{name:'刷新市场与自选',exact:true}).click();await expect(page.getByTestId('market-row')).toHaveCount(4);expect(putRows()).toHaveLength(0);});
     |                                                                                                                                                                                                                    ^ Error: expect(locator).toContainText(expected) failed
  20 | test('malformed cross-venue quote is rejected with cleared rows',async({page})=>{await page.route('**/v1/markets/quotes?**',async route=>{const response=await route.fetch(),body=await response.json();body.items[0].provenance.venue=body.items[0].provenance.venue==='binance'?'coinbase':'binance';await route.fulfill({response,json:body});});await page.goto('/markets');await authorized(page);await expect(page.getByRole('alert')).toContainText('Market 请求未完成');await expect(page.getByTestId('market-row')).toHaveCount(0);expect(putRows()).toHaveLength(0);});
  21 | test('light and dark responsive market rows, keyboard and axe evidence',async({page},info)=>{await open(page);const scans=[];for(const theme of ['dark','light']){await page.emulateMedia({colorScheme:theme as 'dark'|'light'});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await expect(page.getByTestId('market-row')).toHaveCount(4);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const scan=await new AxeBuilder({page}).analyze();scans.push({theme,width,violations:scan.violations,incomplete:scan.incomplete});expect(scan.violations).toEqual([]);await page.screenshot({path:info.outputPath(`markets-${theme}-${width}.png`),fullPage:true});}}await page.getByLabel('搜索标的',{exact:true}).focus();await page.keyboard.type('ETH');await expect(page.getByTestId('market-row')).toHaveCount(2);await writeFile(info.outputPath('ui401-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));expect(networkRows().filter(r=>!['GET','PUT'].includes(r.method))).toEqual([]);});
  22 | 
```