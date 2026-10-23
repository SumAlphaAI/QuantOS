# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p18.spec.ts >> P18 readonly viewer cannot change watchlist; C16 remains a scoped personal preference contract
- Location: tests/e2e/ui-p18.spec.ts:19:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('status').filter({ hasText: /告警偏好：已保存/ })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('status').filter({ hasText: /告警偏好：已保存/ })

```

```yaml
- link "跳至正文":
  - /url: "#_r_0_"
- banner:
  - button "折叠侧栏" [expanded]: SUMALPHA
  - text: ▣ 33333333-3333-4333-8333-333333333333 44444444-4444-4444-8444-444444444444 PAPER
  - textbox "全局搜索" [disabled]:
    - /placeholder: 搜索  ⌘K
  - button "通知" [disabled]: ♧
  - button "帮助": "?"
  - link "打开个人设置":
    - /url: /settings/profile
    - text: Q
- complementary "主导航":
  - navigation:
    - link "Markets":
      - /url: /markets
- main:
  - navigation "Markets 导航":
    - link "Markets":
      - /url: /markets
  - heading "Markets" [level=1]
  - paragraph: 已授权市场目录、跨 venue 报价与数据状态。
  - button "保存筛选"
  - button "列布局"
  - button "刷新市场与自选"
  - button "切换主题": 主题
  - text: Catalog
  - strong: "4"
  - text: instruments 已读来源
  - strong: "2"
  - text: 可执行 venue
  - strong: "0"
  - text: 报价不可用
  - strong: "0"
  - paragraph: ⓘ 报价来自当前获授权数据源。source / asOf / latency / quality 均来自服务端；快照超过两秒标记陈旧。不同产品、币种与 lot size 不合并。
  - complementary "自选市场":
    - heading "自选市场" [level=2]
    - text: ★ 0
    - group "市场列表视图":
      - button "自选 0"
      - button "最近访问 0"
      - button "全部 4" [pressed]
    - link "BTC/USDT binance · spot":
      - /url: /markets/BTC%2FUSDT?venue=binance&product=spot
      - strong: BTC/USDT
      - text: binance · spot
    - text: 104 目录引用
    - link "ETH/USDT binance · spot":
      - /url: /markets/ETH%2FUSDT?venue=binance&product=spot
      - strong: ETH/USDT
      - text: binance · spot
    - text: 104 目录引用
    - link "BTC/USDT coinbase · spot":
      - /url: /markets/BTC%2FUSDT?venue=coinbase&product=spot
      - strong: BTC/USDT
      - text: coinbase · spot
    - text: 124 目录引用
    - link "ETH/USDT coinbase · spot":
      - /url: /markets/ETH%2FUSDT?venue=coinbase&product=spot
      - strong: ETH/USDT
      - text: coinbase · spot
    - text: 124 目录引用
    - paragraph: 自选仅保存个人偏好，不形成交易信号。最近访问仅在当前内存保留。
  - region "市场目录工作区":
    - text: 搜索标的
    - textbox "搜索标的":
      - /placeholder: Symbol / 计价货币
    - text: Venue
    - combobox "Venue":
      - option "全部" [selected]
      - option "binance"
      - option "coinbase"
    - text: 计价货币
    - combobox "计价货币":
      - option "全部" [selected]
      - option "USDT"
    - text: 数据状态
    - combobox "数据状态":
      - option "全部" [selected]
      - option "passed"
      - option "degraded"
      - option "不可用"
    - button "清除筛选"
    - heading "市场目录 4" [level=2]
    - text: 逐 instrument · UTC 时间
    - region "市场目录可滚动表格":
      - table "市场目录":
        - rowgroup:
          - row "自选 Symbol / 产品 最新价 / 24h % 24h 成交量 Bid / Ask · Spread 数据状态 Source / asOf / latency":
            - columnheader "自选"
            - columnheader "Symbol / 产品"
            - columnheader "最新价 / 24h %"
            - columnheader "24h 成交量"
            - columnheader "Bid / Ask · Spread"
            - columnheader "数据状态"
            - columnheader "Source / asOf / latency"
        - rowgroup:
          - row "自选 binance:spot:BTC/USDT BTC/USDT binance · spot 104 24h — — 未返回 103.90 / 104.10 Spread 0.20 passed · 陈旧快照 approved.binance.spot 2026-10-23T13:05:19.276017Z 124 ms · 服务端快照":
            - cell "自选 binance:spot:BTC/USDT":
              - checkbox "自选 binance:spot:BTC/USDT" [disabled]
            - rowheader "BTC/USDT binance · spot":
              - link "BTC/USDT":
                - /url: /markets/BTC%2FUSDT?venue=binance&product=spot
              - text: binance · spot
            - cell "104 24h —"
            - cell "— 未返回"
            - cell "103.90 / 104.10 Spread 0.20"
            - cell "passed · 陈旧快照"
            - cell "approved.binance.spot 2026-10-23T13:05:19.276017Z 124 ms · 服务端快照":
              - text: approved.binance.spot
              - time: 2026-10-23T13:05:19.276017Z
              - text: 124 ms · 服务端快照
          - row "自选 binance:spot:ETH/USDT ETH/USDT binance · spot 104 24h — — 未返回 103.90 / 104.10 Spread 0.20 passed · 陈旧快照 approved.binance.spot 2026-10-23T13:05:19.276017Z 112 ms · 服务端快照":
            - cell "自选 binance:spot:ETH/USDT":
              - checkbox "自选 binance:spot:ETH/USDT" [disabled]
            - rowheader "ETH/USDT binance · spot":
              - link "ETH/USDT":
                - /url: /markets/ETH%2FUSDT?venue=binance&product=spot
              - text: binance · spot
            - cell "104 24h —"
            - cell "— 未返回"
            - cell "103.90 / 104.10 Spread 0.20"
            - cell "passed · 陈旧快照"
            - cell "approved.binance.spot 2026-10-23T13:05:19.276017Z 112 ms · 服务端快照":
              - text: approved.binance.spot
              - time: 2026-10-23T13:05:19.276017Z
              - text: 112 ms · 服务端快照
          - row "自选 coinbase:spot:BTC/USDT BTC/USDT coinbase · spot 124 24h — — 未返回 123.90 / 124.10 Spread 0.20 passed · 陈旧快照 approved.coinbase.spot 2026-10-23T13:05:19.276017Z 113 ms · 服务端快照":
            - cell "自选 coinbase:spot:BTC/USDT":
              - checkbox "自选 coinbase:spot:BTC/USDT" [disabled]
            - rowheader "BTC/USDT coinbase · spot":
              - link "BTC/USDT":
                - /url: /markets/BTC%2FUSDT?venue=coinbase&product=spot
              - text: coinbase · spot
            - cell "124 24h —"
            - cell "— 未返回"
            - cell "123.90 / 124.10 Spread 0.20"
            - cell "passed · 陈旧快照"
            - cell "approved.coinbase.spot 2026-10-23T13:05:19.276017Z 113 ms · 服务端快照":
              - text: approved.coinbase.spot
              - time: 2026-10-23T13:05:19.276017Z
              - text: 113 ms · 服务端快照
          - row "自选 coinbase:spot:ETH/USDT ETH/USDT coinbase · spot 124 24h — — 未返回 123.90 / 124.10 Spread 0.20 passed · 陈旧快照 approved.coinbase.spot 2026-10-23T13:05:19.276017Z 115 ms · 服务端快照":
            - cell "自选 coinbase:spot:ETH/USDT":
              - checkbox "自选 coinbase:spot:ETH/USDT" [disabled]
            - rowheader "ETH/USDT coinbase · spot":
              - link "ETH/USDT":
                - /url: /markets/ETH%2FUSDT?venue=coinbase&product=spot
              - text: coinbase · spot
            - cell "124 24h —"
            - cell "— 未返回"
            - cell "123.90 / 124.10 Spread 0.20"
            - cell "passed · 陈旧快照"
            - cell "approved.coinbase.spot 2026-10-23T13:05:19.276017Z 115 ms · 服务端快照":
              - text: approved.coinbase.spot
              - time: 2026-10-23T13:05:19.276017Z
              - text: 115 ms · 服务端快照
    - status: 已保存 · objectVersion：watchlist-0 · 0/100
    - button "保存自选" [disabled]
    - button "放弃本地修改" [disabled]
    - text: 当前身份自选只读
    - paragraph: 24h 涨跌 / 成交量：C12 未返回；不使用演示数值补齐。
  - region "Venue 报价比较":
    - heading "Venue 报价" [level=2]
    - text: 逐 venue / product 参考
    - region "Venue 报价可滚动表格":
      - table "Venue 报价比较":
        - rowgroup:
          - row "Venue / 产品 Bid / Ask / Mid Spread 费用 / 滑点 Lot / Min notional 质量 / asOf / 来源":
            - columnheader "Venue / 产品"
            - columnheader "Bid / Ask / Mid"
            - columnheader "Spread"
            - columnheader "费用 / 滑点"
            - columnheader "Lot / Min notional"
            - columnheader "质量 / asOf / 来源"
        - rowgroup:
          - row "binance spot · 不可执行 103.90 / 104.10 Mid 104.00 0.20 — / — 暂无估计 0.0001 10 passed · 陈旧快照 approved.binance.spot 2026-10-23T13:05:19.276017Z · 124 ms":
            - rowheader "binance spot · 不可执行":
              - link "binance":
                - /url: /markets/BTC%2FUSDT?venue=binance&product=spot
              - text: spot · 不可执行
            - cell "103.90 / 104.10 Mid 104.00"
            - cell "0.20"
            - cell "— / — 暂无估计"
            - cell "0.0001 10"
            - cell "passed · 陈旧快照 approved.binance.spot 2026-10-23T13:05:19.276017Z · 124 ms"
          - row "coinbase spot · 不可执行 123.90 / 124.10 Mid 124.00 0.20 — / — 暂无估计 0.0001 10 passed · 陈旧快照 approved.coinbase.spot 2026-10-23T13:05:19.276017Z · 113 ms":
            - rowheader "coinbase spot · 不可执行":
              - link "coinbase":
                - /url: /markets/BTC%2FUSDT?venue=coinbase&product=spot
              - text: spot · 不可执行
            - cell "123.90 / 124.10 Mid 124.00"
            - cell "0.20"
            - cell "— / — 暂无估计"
            - cell "0.0001 10"
            - cell "passed · 陈旧快照 approved.coinbase.spot 2026-10-23T13:05:19.276017Z · 113 ms"
    - paragraph: 不同产品、币种与 lot size 分行展示；无最优 venue、智能路由或执行承诺。
  - complementary "Instrument Detail":
    - region "标的详情":
      - heading "BTC/USDT" [level=2]
      - text: BTC / USDT · spot passed · 陈旧快照
      - paragraph: 104 USDT
      - paragraph: 24h 涨跌 / 成交量：— · 当前 C12 未返回
      - term: 规范化 symbol
      - definition: BTC/USDT
      - term: Base / Quote
      - definition: BTC / USDT
      - term: Venue / product
      - definition: binance / spot
      - term: 交易状态
      - definition: 参考报价，不可执行
      - term: asOf
      - definition: 2026-10-23T13:05:19.276017Z
      - status: 报价流：disconnected · 快照冻结，请显式重连
      - button "重连选中报价"
      - button "查看 K 线" [disabled]
      - button "打开交易单" [disabled]
      - paragraph: K 线工作区由 UI-P19 交付，当前未开放。
      - paragraph: C12 报价不可执行；交易单由后续执行工作区提供，不创建订单。
    - region "数据血缘与权限":
      - heading "数据血缘与权限" [level=2]
      - term: source / latency
      - definition: approved.binance.spot · 124 ms
      - term: 许可
      - definition: fixture-only
      - term: 审批引用 / 版本
      - definition: fixture:r01-replay-only / v2
      - term: Snapshot
      - definition: 512bfee9-a1f3-4b96-88b5-e83f96239576
      - term: capability
      - definition: top_of_book · topOfBook true
      - term: intervals
      - definition: 1m, 5m, 15m, 1h, 4h, 1D, 1W
      - term: timezones
      - definition: UTC, Asia/Shanghai
      - term: Sequence
      - definition: "6"
      - link "查看数据血缘快照":
        - /url: /data-snapshots/512bfee9-a1f3-4b96-88b5-e83f96239576
    - region "市场告警偏好":
      - heading "告警与偏好" [level=2]
      - text: C16
      - paragraph: 市场域订阅 · 用户级偏好
      - text: 订阅市场告警
      - checkbox "订阅市场告警" [disabled]
      - paragraph: 价格 / 数据陈旧具体规则由告警源管理；C16 未提供单标的价格阈值规则。其余告警域与级别会完整保留。
      - status: 告警偏好：尚未读取 · v—
      - button "读取告警偏好" [disabled]
      - button "保存市场告警偏好" [disabled]
      - paragraph: 当前无 alerts.read，告警偏好不可用。
  - region "已选择市场上下文":
    - text: 已选择的规范化标的
    - strong: BTC/USDT
    - text: Venue / Product binance / spot 数据 asOf / 模式 2026-10-23T13:05:19.276017Z · paper
    - paragraph: 报价仅供信息和复核，不构成投资建议或最优执行承诺。
- contentinfo "连接状态": Market stream：disconnected 快照仅供研究 · 不可执行 · paper
- alert
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
> 8  | async function open(page:Page,path='/markets'){await page.goto(path);await authorized(page);await expect(page.getByTestId('market-row')).toHaveCount(4);await expect(page.getByRole('status').filter({hasText:/告警偏好：已保存/})).toBeVisible();}
     |                                                                                                                                                                                                                             ^ Error: expect(locator).toBeVisible() failed
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
  19 | test('P18 readonly viewer cannot change watchlist; C16 remains a scoped personal preference contract',async({page})=>{fault({readonly:true});await open(page);await expect(page.getByText('当前身份自选只读',{exact:true})).toBeVisible();await expect(page.getByLabel(`自选 ${btc}`,{exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'保存自选',exact:true})).toBeDisabled();expect(watchWrites()).toHaveLength(0);});
  20 | test('P18 offline clears quotes, subscription drafts and stream then explicit recovery only reads',async({page})=>{await open(page,detail);await page.getByLabel(`自选 ${btc}`,{exact:true}).check();await page.getByLabel('订阅市场告警',{exact:true}).uncheck();await page.evaluate(()=>dispatchEvent(new Event('offline')));await expect(page.getByRole('heading',{name:'Market 访问条件已变化'})).toBeVisible();await expect(page.getByTestId('instrument-detail')).toHaveCount(0);await expect(page.getByText(/最后报价同步/)).toBeVisible();await page.getByRole('button',{name:'重新核对访问权限',exact:true}).click();await authorized(page);await expect(page.getByLabel(`自选 ${btc}`,{exact:true})).not.toBeChecked();await expect(page.getByLabel('订阅市场告警',{exact:true})).toBeChecked();expect(watchWrites()).toHaveLength(0);expect(alertWrites()).toHaveLength(0);});
  21 | test('P18 saved filters/layout persist only UI preferences, and recent visits stay in memory',async({page})=>{await open(page);await page.getByLabel('搜索标的',{exact:true}).fill('ETH');await page.getByLabel('Venue',{exact:true}).selectOption('coinbase');await page.getByRole('button',{name:'列布局',exact:true}).click();await page.getByLabel('密度',{exact:true}).selectOption('compact');await page.getByRole('button',{name:'保存筛选',exact:true}).click();const storage=await page.evaluate(()=>JSON.parse(localStorage.getItem('quantos.p18.view.v1')!));expect(Object.keys(storage).sort()).toEqual(['search','venue','currency','quality','tab','density','provenance'].sort());await page.reload();await authorized(page);await expect(page.getByLabel('搜索标的',{exact:true})).toHaveValue('ETH');await expect(page.getByTestId('market-row')).toHaveCount(1);await page.getByRole('button',{name:'清除筛选',exact:true}).click();await page.getByTestId('market-row').first().getByRole('link').click();await page.getByRole('button',{name:/^最近访问 1$/}).click();await expect(page.getByTestId('market-row')).toHaveCount(1);expect(networkRows().some(r=>r.method==='PUT')).toBe(false);});
  22 | test('P18 empty catalog, unknown symbol and malformed paths stay closed without fake prices',async({page})=>{fault({empty:true});await page.goto('/markets');await authorized(page);await expect(page.getByText('当前筛选没有可见市场。请清除筛选或添加自选。',{exact:true})).toBeVisible();fault({});await page.goto('/markets/UNKNOWN%2FUSDT?venue=binance&product=spot');await authorized(page);await expect(chosen(page)).toContainText('目录未返回对应授权标的');await expect(page.getByRole('link',{name:'查看数据血缘快照',exact:true})).toHaveCount(0);const before=networkRows().length;await page.goto('/markets/BTC%2FUSDT?venue=binance&product=perpetual');await expect(page.getByRole('heading',{name:'Market 引用无效'})).toBeVisible();expect(networkRows()).toHaveLength(before);const r=await page.goto('/markets/BTC/USDT');expect(r?.status()).toBe(404);});
  23 | test('P18 selected quote feed disconnect freezes last fact; explicit resume binds its cursor',async({page})=>{await open(page,detail);await expect(chosen(page).getByRole('status')).toContainText('报价流：disconnected');await page.getByRole('button',{name:'重连选中报价',exact:true}).click();await expect(chosen(page).getByRole('status')).toContainText('报价流：disconnected');const streams=networkRows().filter(r=>r.path==='/v1/markets/quotes/stream');expect(streams.length).toBeGreaterThanOrEqual(2);await expect(chosen(page)).toContainText('coinbase / spot');expect(watchWrites()).toHaveLength(0);});
  24 | test('P18 overview/detail dark/light 1672/1024/390 visual and accessibility matrix',async({page},info)=>{const scans=[],geometry=[];for(const path of ['/markets',detail]){await open(page,path);for(const theme of ['dark','light'] as const){await page.emulateMedia({colorScheme:theme});for(const width of [1672,1024,390]){await page.setViewportSize({width,height:1000});await expect(chosen(page)).toBeAttached();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const a=await new AxeBuilder({page}).analyze();scans.push({path,theme,width,violations:a.violations,incomplete:a.incomplete});expect(a.violations).toEqual([]);expect(a.incomplete.some(r=>r.id==='aria-prohibited-attr')).toBe(false);geometry.push({path,theme,width,watch:await page.getByRole('complementary',{name:'自选市场',exact:true}).boundingBox(),market:await page.getByRole('region',{name:'市场目录工作区',exact:true}).boundingBox(),detail:await chosen(page).boundingBox()});await page.screenshot({path:info.outputPath(`p18-${path==='/markets'?'overview':'detail'}-${theme}-${width}.png`),fullPage:true});}}}await writeFile(info.outputPath('p18-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));await writeFile(info.outputPath('p18-geometry.json'),JSON.stringify(geometry,null,2));});
  25 | 
```