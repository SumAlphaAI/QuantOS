# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p21.spec.ts >> P21 explicit synthetic consumer fixture shows dense curve, gap and signed attribution without provider claims
- Location: tests/e2e/ui-p21.spec.ts:15:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('region', { name: '收益来源' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('region', { name: '收益来源' })

```

```yaml
- link "跳至正文":
  - /url: "#_r_0_"
- banner:
  - button "折叠侧栏" [expanded]: SUMALPHA
  - text: ▣ 33333333 44444444 SHADOW
  - textbox "全局搜索" [disabled]:
    - /placeholder: 搜索  ⌘K
  - button "通知" [disabled]: ♧
  - button "帮助": "?"
  - link "打开个人设置":
    - /url: /settings/profile
    - text: Q
- complementary "主导航":
  - navigation:
    - link "Command":
      - /url: /command
    - link "Research":
      - /url: /research
    - link "Strategy":
      - /url: /strategies
    - link "Portfolio":
      - /url: /portfolio
    - link "Markets":
      - /url: /markets
    - link "Trade":
      - /url: /trade
    - link "Performance":
      - /url: /performance
    - link "Proposals":
      - /url: /proposals
    - link "Approvals":
      - /url: /approvals
    - link "Orders":
      - /url: /orders
    - link "Audit":
      - /url: /audit
    - link "Operations":
      - /url: /operations
- main:
  - navigation "页面路径":
    - link "Portfolio":
      - /url: /portfolio
    - text: / Performance
  - heading "Performance" [level=1]
  - paragraph: 收益基于已核对来源与版本化估值；历史收益不保证未来表现。
  - button "保存视图"
  - button "对比期间 · 未提供" [disabled]
  - button "刷新当前口径" [disabled]
  - button "查看报表任务"
  - button "切换主题"
  - form "收益口径":
    - text: Account / 账户
    - textbox "账户": 44444444-4444-4444-8444-444444444444
    - text: Base currency
    - combobox "基准币种":
      - option "USD" [selected]
    - text: 计算方法
    - combobox "计算方法":
      - option "simple · 简单收益" [selected]
      - option "TWR 未支持" [disabled]
      - option "MWR 未支持" [disabled]
    - text: Timezone
    - textbox "时区": UTC
    - text: 周期
    - combobox "周期":
      - option "周" [selected]
      - option "月"
      - option "季"
      - option "年"
      - option "自定义"
    - text: 周期口径
    - combobox "周期口径":
      - option "rolling · 滚动" [selected]
      - option "calendar · 自然周期（UTC）"
    - text: Mode
    - textbox "账户模式": SHADOW
    - button "读取收益"
  - alert: 无法核对收益来源、报告或下载，请显式重新读取。
  - status:
    - text: 尚无本次已核对的收益数据，未填入演示统计。
    - paragraph: 当前仅 USD / simple / UTC、当前授权 Shadow 账户。
  - heading "收益与归因" [level=2]
  - paragraph: 读取有效范围后展示源权益、回撤与归因。
  - complementary "收益报表工作区":
    - region "周期报告生成":
      - heading "收益报表" [level=2]
      - text: 固定版本 · 异步生成
      - paragraph: 报表将固定本次计算口径、账本版本、估值快照和生成时间。
      - term: 报表周期
      - definition: 尚未读取 / —
      - term: 账户范围
      - definition: 44444444-4444-4444-8444-444444444444
      - term: 基准 / 语言
      - definition: 未提供 / JSON 原始字段
      - term: 导出格式
      - definition: JSON PDF / CSV 未支持
      - heading "包含内容" [level=3]
      - list:
        - listitem: 收益概览
        - listitem: 权益与回撤
        - listitem: 标的归因
        - listitem: 费用
        - listitem: 数据与方法
      - heading "计算与版本" [level=3]
      - term: Method
      - definition: simple
      - term: Ledger
      - definition: —
      - term: Valuation snapshot
      - definition: —
      - term: Status
      - definition: 预览未读取
      - paragraph: 已应用 end：—。生成使用已读取期间，不使用未提交筛选草稿。
      - button "生成收益报表" [disabled]
      - paragraph: 202 仅 queued；手工读取状态后再核对报告/下载。短时授权到期后需重新获取。
      - button "查看本会话报表任务 →"
    - region "报表任务":
      - heading "报表任务 · 0/25" [level=2]
      - button "展开任务"
  - text: 当前仅 USD / simple / UTC、当前授权 Shadow 账户；策略/venue/已实现拆分/年化/订阅/其他格式未由 C14 提供。来源核对不代表正式联调或生产验收。
- contentinfo "连接状态": SHADOW · C14/C15只读事实 最后读取 — 历史收益不保证未来表现
- alert
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import {installP21Series} from './fixtures/p21-series';
  3  | import AxeBuilder from '@axe-core/playwright';
  4  | import {writeFile} from 'node:fs/promises';
  5  | import {installReferenceHooks,authorized,networkRows} from './fixtures/ui403-reference';
  6  | installReferenceHooks();
> 7  | async function open(page:Page){await page.goto('/performance');await authorized(page);await expect(page.getByRole('region',{name:'收益来源'})).toBeVisible();}
     |                                                                                                                                            ^ Error: expect(locator).toBeVisible() failed
  8  | const writes=()=>networkRows().filter(r=>r.method==='POST');
  9  | test('P21 actual source charts, exact values and keyboard selection preserve provisional status',async({page})=>{await open(page);const chart=page.getByRole('region',{name:'权益曲线'});await expect(chart.getByRole('img')).toHaveAttribute('aria-label',/全部暂定/);await expect(chart.locator('.p21-confirmed-line')).toHaveCount(0);await chart.getByRole('button',{name:'累计 P&L',exact:true}).click();await expect(chart.getByRole('img')).toHaveAttribute('aria-label',/累计 P&L/);const slider=page.getByRole('slider',{name:'选择快照'});await slider.focus();await slider.press('End');await expect(slider).toHaveValue('1');await expect(chart.locator('.p21-tooltip')).toContainText('PROVISIONAL');await slider.press('Home');await expect(slider).toHaveValue('0');await page.getByLabel('显示原始收益序列').check();await expect(page.getByRole('region',{name:'收益时间序列表'})).toContainText('sha256:');await expect(page.getByRole('button',{name:'策略 · 未提供'})).toBeDisabled();expect(writes()).toHaveLength(0);});
  10 | test('P21 saves allowlisted view only, reopens and excludes sensitive account/query/report data',async({page})=>{await open(page);await page.getByRole('button',{name:'累计 P&L',exact:true}).click();await page.getByLabel('显示原始收益序列').check();await page.getByRole('button',{name:'保存视图',exact:true}).click();const saved=await page.evaluate(()=>localStorage.getItem('quantos.performance.display.v1'));expect(JSON.parse(saved!)).toEqual({metric:'pnl',showTable:true});await page.reload();await authorized(page);await expect(page.getByRole('button',{name:'累计 P&L',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByLabel('显示原始收益序列')).toBeChecked();await page.evaluate(()=>localStorage.setItem('quantos.performance.display.v1','{"metric":"script","reportId":"forged","showTable":false}'));await page.reload();await authorized(page);await expect(page.getByRole('button',{name:'净值',exact:true})).toHaveAttribute('aria-pressed','true');expect(writes()).toHaveLength(0);});
  11 | test('P21 draft/apply, queued/frozen report task navigation and canonical refresh are explicit',async({page},info)=>{await open(page);await page.getByLabel('周期',{exact:true}).selectOption('month');await expect(page.getByRole('button',{name:'生成收益报表',exact:true})).toBeDisabled();await expect(page.getByRole('region',{name:'周期报告生成'})).toContainText('筛选草稿已更改');await page.getByRole('button',{name:'读取收益',exact:true}).click();await expect(page.getByRole('button',{name:'生成收益报表',exact:true})).toBeEnabled();await page.getByRole('button',{name:'生成收益报表',exact:true}).click();const detail=page.getByRole('region',{name:'固定版本报告'});await expect(detail).toContainText('queued');await expect(detail.getByRole('button',{name:'校验并下载 JSON'})).toBeDisabled();await page.getByRole('button',{name:'查看报表任务',exact:true}).click();await expect(page.locator('#p21-tasks')).toBeFocused();await expect(page.getByRole('region',{name:'报表任务'})).toContainText('queued');await detail.getByRole('button',{name:'刷新此报告状态'}).click();await expect(detail).toContainText('succeeded');await expect(page).toHaveURL(/\/performance\/reports\/[a-f0-9-]{36}$/);await detail.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('p21-report-succeeded-dark-1440.png'),fullPage:true});await page.reload();await authorized(page);await expect(page.getByRole('region',{name:'固定版本报告'})).toContainText('succeeded');await expect(page.getByRole('region',{name:'收益来源'})).toHaveCount(0);expect(writes()).toHaveLength(1);});
  12 | test('P21 saved preference failure is recoverable and route errors never expose private facts',async({page})=>{await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw Error('denied');};});await open(page);await page.getByRole('button',{name:'保存视图',exact:true}).click();await expect(page.getByRole('status')).toContainText('未允许保存视图');await expect(page.getByRole('region',{name:'收益来源'})).toBeVisible();await page.goto('/performance/reports/invalid');await expect(page.locator('[data-route-access="authorized"]')).toHaveCount(0);expect(writes()).toHaveLength(0);});
  13 | test('P21 source-only dark/light responsive layouts, chart/table scrolling and axe',async({page},info)=>{await open(page);const scans=[],geometry=[];for(const theme of ['dark','light'] as const){await page.emulateMedia({colorScheme:theme});for(const width of [1672,1440,1024,390]){await page.setViewportSize({width,height:1000});await page.locator('main').evaluate(el=>el.scrollTop=0);const box=await page.evaluate(()=>{const rect=(s:string)=>{const r=document.querySelector(s)!.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};return{pageOverflow:document.documentElement.scrollWidth>innerWidth,analysis:rect('.p21-analysis'),reports:rect('.p21-reports'),chart:rect('.p21-equity svg'),metrics:rect('.performance-metrics')};});geometry.push({theme,width,...box});expect(box.pageOverflow).toBe(false);if(width>=1440)expect(box.reports.x).toBeGreaterThan(box.analysis.x);if(width<=1024)expect(box.reports.y).toBeGreaterThan(box.analysis.y);const scan=await new AxeBuilder({page}).analyze();scans.push({theme,width,violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath('p21-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));await writeFile(info.outputPath('p21-geometry.json'),JSON.stringify(geometry,null,2));expect(scan.violations).toEqual([]);await page.screenshot({path:info.outputPath(`p21-${theme}-${width}.png`),fullPage:true});}}await page.getByLabel('显示原始收益序列').check();const table=page.getByRole('region',{name:'收益时间序列表'});await table.focus();await table.press('ArrowRight');expect(await table.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);expect(writes()).toHaveLength(0);});
  14 | 
  15 | test('P21 explicit synthetic consumer fixture shows dense curve, gap and signed attribution without provider claims',async({page},info)=>{await installP21Series(page);await open(page);const chart=page.getByRole('region',{name:'权益曲线'});await expect(chart.locator('[data-source-segment]')).toHaveCount(12);await expect(page.getByRole('region',{name:'收益归因'})).toContainText('-299.5');await expect(page.getByRole('region',{name:'快照权益变化'})).toContainText('缺口');await page.setViewportSize({width:1672,height:1000});await page.screenshot({path:info.outputPath('p21-explicit-consumer-dark-1672.png'),fullPage:true});await writeFile(info.outputPath('p21-synthetic-scope.json'),JSON.stringify({scope:'EXPLICIT_SYNTHETIC_C14_C15_CONSUMER_ONLY',providerAcceptance:false,liveCashflow:false,points:14,gapSegmentsOmitted:1,sourceCommit:process.env.GITHUB_SHA}));expect(writes()).toHaveLength(0);});
  16 | 
```