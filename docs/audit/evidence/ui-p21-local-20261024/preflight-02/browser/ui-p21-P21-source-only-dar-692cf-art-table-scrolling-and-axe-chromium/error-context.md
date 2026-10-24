# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p21.spec.ts >> P21 source-only dark/light responsive layouts, chart/table scrolling and axe
- Location: tests/e2e/ui-p21.spec.ts:13:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 108

- Array []
+ Array [
+   Object {
+     "description": "Ensure elements that have scrollable content are accessible by keyboard in Safari",
+     "help": "Scrollable region must have keyboard access",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.13/scrollable-region-focusable?application=playwright",
+     "id": "scrollable-region-focusable",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": null,
+             "id": "focusable-content",
+             "impact": "serious",
+             "message": "Element should have focusable content",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "focusable-element",
+             "impact": "serious",
+             "message": "Element should be focusable",
+             "relatedNodes": Array [],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element should have focusable content
+   Element should be focusable",
+         "html": "<div class=\"p21-chart-scroll\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".p21-chart-scroll",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": null,
+             "id": "focusable-content",
+             "impact": "serious",
+             "message": "Element should have focusable content",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "focusable-element",
+             "impact": "serious",
+             "message": "Element should be focusable",
+             "relatedNodes": Array [],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element should have focusable content
+   Element should be focusable",
+         "html": "<dd>sha256:58c2338ba0a1c86057e7da16dbacf298f8e5d318be3966e2347a5da8afcb475f</dd>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "dd:nth-child(4)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": null,
+             "id": "focusable-content",
+             "impact": "serious",
+             "message": "Element should have focusable content",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "focusable-element",
+             "impact": "serious",
+             "message": "Element should be focusable",
+             "relatedNodes": Array [],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element should have focusable content
+   Element should be focusable",
+         "html": "<dd>sha256:fd9196d0615f68162d88b1017fe8d7be93d18ee4533c203d89a0be02828bdb9d</dd>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "dd:nth-child(6)",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.keyboard",
+       "wcag2a",
+       "wcag211",
+       "wcag213",
+       "TTv5",
+       "TT4.a",
+       "EN-301-549",
+       "EN-9.2.1.1",
+       "EN-9.2.1.3",
+       "RGAAv4",
+       "RGAA-7.3.2",
+     ],
+   },
+ ]
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import {installP21Series} from './fixtures/p21-series';
  3  | import AxeBuilder from '@axe-core/playwright';
  4  | import {writeFile} from 'node:fs/promises';
  5  | import {installReferenceHooks,authorized,networkRows} from './fixtures/ui403-reference';
  6  | installReferenceHooks();
  7  | async function open(page:Page){await page.goto('/performance');await authorized(page);await expect(page.getByRole('region',{name:'收益来源'})).toBeVisible();}
  8  | const writes=()=>networkRows().filter(r=>r.method==='POST');
  9  | test('P21 actual source charts, exact values and keyboard selection preserve provisional status',async({page})=>{await open(page);const chart=page.getByRole('region',{name:'权益曲线'});await expect(chart.getByRole('img')).toHaveAttribute('aria-label',/全部暂定/);await expect(chart.locator('.p21-confirmed-line')).toHaveCount(0);await chart.getByRole('button',{name:'累计 P&L',exact:true}).click();await expect(chart.getByRole('img')).toHaveAttribute('aria-label',/累计 P&L/);const slider=page.getByRole('slider',{name:'选择快照'});await slider.focus();await slider.press('End');await expect(slider).toHaveValue((await slider.getAttribute('max'))!);await expect(chart.locator('.p21-tooltip')).toContainText('PROVISIONAL');await slider.press('Home');await expect(slider).toHaveValue('0');await page.getByLabel('显示原始收益序列').check();await expect(page.getByRole('region',{name:'收益时间序列表'})).toContainText('sha256:');await expect(page.getByRole('button',{name:'策略 · 未提供'})).toBeDisabled();expect(writes()).toHaveLength(0);});
  10 | test('P21 saves allowlisted view only, reopens and excludes sensitive account/query/report data',async({page})=>{await open(page);await page.getByRole('button',{name:'累计 P&L',exact:true}).click();await page.getByLabel('显示原始收益序列').check();await page.getByRole('button',{name:'保存视图',exact:true}).click();const saved=await page.evaluate(()=>localStorage.getItem('quantos.performance.display.v1'));expect(JSON.parse(saved!)).toEqual({metric:'pnl',showTable:true});await page.reload();await authorized(page);await expect(page.getByRole('button',{name:'累计 P&L',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByLabel('显示原始收益序列')).toBeChecked();await page.evaluate(()=>localStorage.setItem('quantos.performance.display.v1','{"metric":"script","reportId":"forged","showTable":false}'));await page.reload();await authorized(page);await expect(page.getByRole('button',{name:'净值',exact:true})).toHaveAttribute('aria-pressed','true');expect(writes()).toHaveLength(0);});
  11 | test('P21 draft/apply, queued/frozen report task navigation and canonical refresh are explicit',async({page},info)=>{await open(page);await page.getByLabel('周期',{exact:true}).selectOption('month');await expect(page.getByRole('button',{name:'生成收益报表',exact:true})).toBeDisabled();await expect(page.getByRole('region',{name:'周期报告生成'})).toContainText('筛选草稿已更改');await page.getByRole('button',{name:'读取收益',exact:true}).click();await expect(page.getByRole('button',{name:'生成收益报表',exact:true})).toBeEnabled();await page.getByRole('button',{name:'生成收益报表',exact:true}).click();const detail=page.getByRole('region',{name:'固定版本报告'});await expect(detail).toContainText('queued');await expect(detail.getByRole('button',{name:'校验并下载 JSON'})).toBeDisabled();await page.getByRole('button',{name:'查看报表任务',exact:true}).click();await expect(page.locator('#p21-tasks')).toBeFocused();await expect(page.getByRole('region',{name:'报表任务'})).toContainText('queued');await detail.getByRole('button',{name:'刷新此报告状态'}).click();await expect(detail).toContainText('succeeded');await expect(page).toHaveURL(/\/performance\/reports\/[a-f0-9-]{36}$/);await detail.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('p21-report-succeeded-dark-1440.png'),fullPage:true});await page.reload();await authorized(page);await expect(page.getByRole('region',{name:'固定版本报告'})).toContainText('succeeded');await expect(page.getByRole('region',{name:'收益来源'})).toHaveCount(0);expect(writes()).toHaveLength(1);});
  12 | test('P21 saved preference failure is recoverable and route errors never expose private facts',async({page})=>{await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw Error('denied');};});await open(page);await page.getByRole('button',{name:'保存视图',exact:true}).click();await expect(page.getByRole('status')).toContainText('未允许保存视图');await expect(page.getByRole('region',{name:'收益来源'})).toBeVisible();await page.goto('/performance/reports/invalid');await expect(page.locator('[data-route-access="authorized"]')).toHaveCount(0);expect(writes()).toHaveLength(0);});
> 13 | test('P21 source-only dark/light responsive layouts, chart/table scrolling and axe',async({page},info)=>{await open(page);const scans=[],geometry=[];for(const theme of ['dark','light'] as const){await page.emulateMedia({colorScheme:theme});for(const width of [1672,1440,1024,390]){await page.setViewportSize({width,height:1000});await page.locator('main').evaluate(el=>el.scrollTop=0);const box=await page.evaluate(()=>{const rect=(s:string)=>{const r=document.querySelector(s)!.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};return{pageOverflow:document.documentElement.scrollWidth>innerWidth,analysis:rect('.p21-analysis'),reports:rect('.p21-reports'),chart:rect('.p21-equity svg'),metrics:rect('.performance-metrics')};});geometry.push({theme,width,...box});expect(box.pageOverflow).toBe(false);if(width>=1440)expect(box.reports.x).toBeGreaterThan(box.analysis.x);if(width<=1024)expect(box.reports.y).toBeGreaterThan(box.analysis.y);const scan=await new AxeBuilder({page}).analyze();scans.push({theme,width,violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath('p21-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));await writeFile(info.outputPath('p21-geometry.json'),JSON.stringify(geometry,null,2));expect(scan.violations).toEqual([]);await page.screenshot({path:info.outputPath(`p21-${theme}-${width}.png`),fullPage:true});}}await page.getByLabel('显示原始收益序列').check();const table=page.getByRole('region',{name:'收益时间序列表'});await table.focus();await table.press('ArrowRight');expect(await table.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);expect(writes()).toHaveLength(0);});
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               ^ Error: expect(received).toEqual(expected) // deep equality
  14 | 
  15 | test('P21 explicit synthetic consumer fixture shows dense curve, gap and signed attribution without provider claims',async({page},info)=>{await installP21Series(page);await open(page);const chart=page.getByRole('region',{name:'权益曲线'});await expect(chart.locator('[data-source-segment]')).toHaveCount(12);await expect(page.getByRole('region',{name:'收益归因'})).toContainText('-299.5');await expect(page.getByRole('region',{name:'快照权益变化'})).toContainText('缺口');await page.setViewportSize({width:1672,height:1000});await page.screenshot({path:info.outputPath('p21-explicit-consumer-dark-1672.png'),fullPage:true});await writeFile(info.outputPath('p21-synthetic-scope.json'),JSON.stringify({scope:'EXPLICIT_SYNTHETIC_C14_C15_CONSUMER_ONLY',providerAcceptance:false,liveCashflow:false,points:14,gapSegmentsOmitted:1,sourceCommit:process.env.GITHUB_SHA}));expect(writes()).toHaveLength(0);});
  16 | 
```