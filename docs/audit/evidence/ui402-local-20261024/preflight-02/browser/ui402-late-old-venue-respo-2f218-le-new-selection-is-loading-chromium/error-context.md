# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui402.spec.ts >> late old venue response cannot repopulate while new selection is loading
- Location: tests/e2e/ui402.spec.ts:10:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.selectOption: Target page, context or browser has been closed
Call log:
  - waiting for getByLabel('Venue', { exact: true })

```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import {writeFile} from 'node:fs/promises';
  4  | import {installReferenceHooks,authorized,networkRows} from './fixtures/ui401-reference';
  5  | installReferenceHooks();
  6  | const path='/markets/BTC%2FUSDT/chart?venue=binance&product=spot';
  7  | async function open(page:Page){await page.goto(path);await authorized(page);await expect(page.getByRole('region',{name:'Series 元数据',exact:true})).toBeVisible();await expect(page.getByTestId('chart-status')).toContainText('disconnected');}
  8  | function noWrites(){expect(networkRows().filter(r=>r.method!=='GET')).toEqual([]);}
  9  | test('actual C12 OHLCV, complete metadata, indicators, venue switch, frozen EOF and explicit resume',async({page})=>{await open(page);await expect(page.getByTestId('candle')).not.toHaveCount(0);for(const name of ['instrumentId','symbol','venue','product','interval','timezone','source','asOf','quality','license','approvalRef','approvalVersion','dataSnapshotId','latencyMs','sequence','replaceSeries','aggregation'])await expect(page.getByRole('region',{name:'Series 元数据',exact:true}).locator('dt').filter({hasText:new RegExp('^'+name+'$')})).toBeVisible();const asOf=await page.getByTestId('chart-confirmed').innerText();await page.getByRole('button',{name:'续传行情',exact:true}).click();await expect(page.getByTestId('chart-status')).toContainText('disconnected');expect(await page.getByTestId('chart-confirmed').innerText()).toBe(asOf);await page.getByLabel('指标',{exact:true}).selectOption('EMA');await page.getByLabel('指标周期',{exact:true}).fill('2');await expect(page.getByRole('img',{name:/OHLCV K 线/})).toHaveAccessibleName(/EMA 2/);await page.getByLabel('Venue',{exact:true}).selectOption('coinbase');await expect(page.getByRole('region',{name:'Series 元数据',exact:true})).toContainText('coinbase:spot:BTC/USDT');await expect(page).toHaveURL(/venue=coinbase/);await page.getByRole('region',{name:'订单成交事实'}).scrollIntoViewIfNeeded();await expect(page.getByRole('region',{name:'订单成交事实'})).toContainText('snapshot');await expect(page.getByRole('region',{name:'订单成交事实'})).toContainText('没有可安全绑定的标记');await page.reload();await authorized(page);await expect(page.getByRole('region',{name:'Series 元数据'})).toContainText('coinbase:spot:BTC/USDT');noWrites();});
> 10 | test('late old venue response cannot repopulate while new selection is loading',async({page})=>{await open(page);await page.route('**/v1/markets/candles?**',async route=>{const response=await route.fetch();if(new URL(route.request().url()).searchParams.get('venue')==='coinbase')await new Promise(r=>setTimeout(r,700));await route.fulfill({response});});await page.getByLabel('Venue',{exact:true}).selectOption('coinbase');await expect(page.getByTestId('candle')).toHaveCount(0);await expect(page.getByTestId('chart-confirmed')).toHaveText('—');await expect(page.getByRole('region',{name:'Series 元数据'})).toContainText('coinbase:spot:BTC/USDT');noWrites();});
     |                                                                                                                                                                                                                                                                                                                                                                                                               ^ Error: locator.selectOption: Target page, context or browser has been closed
  11 | test('malformed series rejection clears old chart; explicit read recovers, no automatic retry',async({page})=>{await open(page);await page.route('**/v1/markets/candles?**',async route=>{const res=await route.fetch(),body=await res.json();body.provenance.venue='coinbase';await route.fulfill({response:res,json:body});});await page.getByRole('button',{name:'读取范围 / 刷新'}).click();await expect(page.getByRole('alert').filter({hasText:'图表请求未完成'})).toBeVisible();await expect(page.getByTestId('candle')).toHaveCount(0);await page.unroute('**/v1/markets/candles?**');await page.getByRole('button',{name:'读取范围 / 刷新'}).click();await expect(page.getByTestId('candle')).not.toHaveCount(0);noWrites();});
  12 | test('offline revocation erases chart and private markers; explicit access recovery reads anew',async({page})=>{await open(page);await page.evaluate(()=>dispatchEvent(new Event('offline')));await expect(page.getByRole('heading',{name:'图表访问不可用'})).toBeVisible();await expect(page.getByTestId('candle')).toHaveCount(0);await expect(page.getByRole('region',{name:'订单成交事实'})).toHaveCount(0);await page.getByRole('button',{name:'重新核对访问权限'}).click();await authorized(page);await expect(page.getByTestId('candle')).not.toHaveCount(0);noWrites();});
  13 | test('unsupported product/deep route is rejected before business reads',async({page})=>{await page.goto(path.replace('spot','perpetual'));await expect(page.getByRole('heading',{name:'图表访问不可用'})).toBeVisible();expect(networkRows()).toEqual([]);const res=await page.goto('/markets/BTC%2fUSDT/chart?venue=binance&product=spot');expect(res?.status()).toBe(404);noWrites();});
  14 | test('explicit C09 spot extension fixture draws order/fill markers, unrelated products stay excluded',async({page})=>{let base:Record<string,unknown>|undefined;await page.route('**/v1/orders?**',async route=>{const response=await route.fetch();if(!base){const at=new Date(Date.now()-60000).toISOString(),id='11111111-1111-4111-8111-111111111111';base={orderId:id,commandId:id,accountId:(await (await page.request.get('https://127.0.0.1:4010/v1/context')).json()).accountId,venue:'binance',venueKind:'binance',productType:'spot',symbol:'BTCUSDT',intent:'open',side:'buy',quantity:'1',status:'filled',filledQuantity:'1',averageFillPrice:'104',mode:'paper',submittedAt:at,correlationId:id,fills:[{fillId:id,quantity:'1',price:'104',at}]};}await route.fulfill({response,json:{items:[base]}});});await open(page);await expect(page.getByRole('region',{name:'订单成交事实'}).getByRole('link')).toHaveCount(2);await expect(page.getByRole('region',{name:'订单成交事实'})).toContainText('fill · buy · 1 @ 104');await page.getByLabel('订单 / 成交标记',{exact:true}).uncheck();await expect(page.getByRole('region',{name:'订单成交事实'}).getByRole('link')).toHaveCount(0);await page.getByLabel('Venue',{exact:true}).selectOption('coinbase');await expect(page.getByRole('region',{name:'订单成交事实'})).toContainText('已排除 1');noWrites();});
  15 | test('responsive dark/light functional chart screenshots and axe',async({page},info)=>{await open(page);const scans=[];for(const theme of ['dark','light'] as const){if(theme==='light')await page.getByRole('button',{name:'切换主题'}).click();for(const width of [1440,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const result=await new AxeBuilder({page}).analyze();scans.push({theme,width,violations:result.violations,incomplete:result.incomplete});await writeFile(info.outputPath('ui402-axe.json'),JSON.stringify({scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));expect(result.violations).toEqual([]);await page.screenshot({path:info.outputPath(`chart-${theme}-${width}.png`),fullPage:true});}}noWrites();});
  16 | 
```