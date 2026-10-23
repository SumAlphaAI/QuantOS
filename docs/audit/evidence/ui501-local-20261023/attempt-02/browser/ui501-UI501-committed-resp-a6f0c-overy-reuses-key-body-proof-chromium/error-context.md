# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui501.spec.ts >> UI501 committed response lost locks original request; refresh does not replay; explicit recovery reuses key/body/proof
- Location: tests/e2e/ui501.spec.ts:14:5

# Error details

```
Error: expect(locator).toBeDisabled() failed

Locator: getByLabel('操作原因', { exact: true })
Expected: disabled
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeDisabled" with timeout 5000ms
  - waiting for getByLabel('操作原因', { exact: true })

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
  - navigation "组合与风险导航":
    - link "Portfolio":
      - /url: /portfolio
    - link "Risk":
      - /url: /risk
  - heading "Portfolio" [level=1]
  - paragraph: 账户 44444444-4444-4444-8444-444444444444 · paper
  - button "重新读取组合与风险"
  - button "切换主题"
  - region "Kill Switch":
    - heading "Kill Switch：未启用" [level=2]
    - status: 数据有效，可审阅风险操作 · asOf：2026-10-23T13:51:25.413314Z · stale：false
    - paragraph: 全局/账户聚合状态 · 风控版本：0 · 操作者：服务端未返回 · 操作时间：服务端未返回
  - alert: 请求未完成。
  - alert:
    - text: 操作结果未知。原动作、内容、MFA 引用与幂等键已锁定；重新读取不会自动重发。
    - button "显式重试原风险操作"
  - region "组合事实":
    - heading "仓位与 P&L" [level=2]
    - term: P&L
    - definition: 0 USD
    - term: 总敞口（来源未标注单位）
    - definition: "500000"
    - term: 仓位数
    - definition: "2"
    - table "账户仓位":
      - rowgroup:
        - row "Symbol 方向 数量 平均成本":
          - columnheader "Symbol"
          - columnheader "方向"
          - columnheader "数量"
          - columnheader "平均成本"
      - rowgroup:
        - row "BTCUSDT long 1000 100":
          - cell "BTCUSDT"
          - cell "long"
          - cell "1000"
          - cell "100"
        - row "ETHUSDT long 4000 100":
          - cell "ETHUSDT"
          - cell "long"
          - cell "4000"
          - cell "100"
    - paragraph: 估值、敞口单位与逐仓 P&L 未由来源提供；不补演示数值。
  - region "风险规则":
    - heading "规则命中" [level=2]
    - list:
      - listitem: Concentration · limitId：0cd66252-ea6d-4119-90e5-e41db8b33461
    - paragraph: 此处仅显示服务端命中事实；规则配置与明细尚未提供。
  - region "风险告警":
    - heading "风险告警" [level=2]
    - paragraph: 查询状态：ready · 与规则命中分别展示
    - paragraph: 当前页无风险告警。
  - region "风险操作":
    - heading "账户 Kill Switch 操作" [level=2]
    - paragraph: 启用由 Owner / Operator 授权；解除仅限 Owner。服务端逐次核验角色权限。操作必须重新认证，当前风险陈旧时禁止。
    - text: 风险动作
    - combobox "风险动作" [disabled]:
      - option "启用 Kill Switch" [selected]
      - option "解除 Kill Switch"
    - text: 操作原因
    - textbox "操作原因" [disabled]: Owned local reference safety check
    - text: 确认短语
    - textbox "确认短语" [disabled]: ENGAGE KILL SWITCH
    - paragraph: 请输入 ENGAGE KILL SWITCH
    - text: MFA 验证码
    - textbox "MFA 验证码" [disabled]
    - button "重新认证并提交风险操作" [disabled]
- contentinfo "连接状态": 组合数据：轮询已核验 paper · 陈旧即禁写
- alert
```

# Test source

```ts
  1  | import { test, expect, type Page } from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import { writeFile } from 'node:fs/promises';
  4  | import { installReferenceHooks, authorized, networkRows, fault, control } from './fixtures/ui501-reference';
  5  | installReferenceHooks();
  6  | const writes=()=>networkRows().filter(r=>r.method==='POST'&&r.path.includes('/kill-switch/')&&!r.control);
  7  | async function open(page:Page,path='/portfolio') {await page.goto(path);await authorized(page);await expect(page.getByRole('status').filter({hasText:'数据有效，可审阅风险操作'})).toBeVisible();}
  8  | async function form(page:Page,action:'engage'|'release'='engage') {await page.getByLabel('风险动作',{exact:true}).selectOption(action);await page.getByLabel('操作原因',{exact:true}).fill('Owned local reference safety check');await page.getByLabel('确认短语',{exact:true}).fill(action==='engage'?'ENGAGE KILL SWITCH':'RELEASE KILL SWITCH');await page.getByLabel('MFA 验证码',{exact:true}).fill('123456');}
  9  | const submit=(page:Page)=>page.getByRole('button',{name:'重新认证并提交风险操作',exact:true});
  10 | const kill=(page:Page)=>page.getByRole('region',{name:'Kill Switch',exact:true});
  11 | test('UI501 actual Portfolio and Risk routes show scoped facts, source timestamps and separate risk alerts',async({page})=>{await open(page);await expect(page.getByRole('table',{name:'账户仓位'})).toContainText('BTCUSDT');await expect(page.getByRole('region',{name:'组合事实'})).toContainText('USD');await expect(kill(page)).toContainText('未启用');await expect(page.getByRole('region',{name:'风险告警'})).toContainText('查询状态：ready');await page.getByRole('navigation',{name:'组合与风险导航'}).getByRole('link',{name:'Risk',exact:true}).click();await authorized(page);await expect(page.getByRole('heading',{name:'Risk',exact:true})).toBeVisible();await expect(kill(page)).toContainText('未启用');expect(writes()).toHaveLength(0);const reads=networkRows().filter(r=>r.path==='/v1/portfolio'||r.path==='/v1/risk'||r.path==='/v1/portfolio/stream');expect(reads.every(r=>r.query.accountId==='44444444-4444-4444-8444-444444444444')).toBe(true);expect(networkRows().some(r=>r.path==='/v1/alerts'&&r.query.domain==='risk')).toBe(true);});
  12 | test('UI501 operator engages with typed MFA and exact phrase, receipt verified, owner-only release refused',async({page})=>{await open(page);await form(page);await page.getByLabel('确认短语',{exact:true}).fill('wrong');await expect(submit(page)).toBeDisabled();await page.getByLabel('确认短语',{exact:true}).fill('ENGAGE KILL SWITCH');await submit(page).click();await expect(page.getByRole('region',{name:'风险操作回执'})).toContainText('auditRef');await expect(kill(page)).toContainText('已启用');await expect(page.getByRole('region',{name:'风险规则'})).toContainText('AccountKill');await form(page,'release');await submit(page).click();await expect(page.getByRole('alert').filter({hasText:'服务端拒绝此操作权限'})).toBeVisible();await expect(kill(page)).toContainText('已启用');expect(writes().map(r=>r.status)).toEqual([200,403]);await expect(page.getByText('private SQL',{exact:false})).toHaveCount(0);});
  13 | test('UI501 owner can release actual account kill and independent operator poll observes broadcast',async({page})=>{fault({actor:'session-owner'});await open(page,'/risk');await form(page);await submit(page).click();await expect(kill(page)).toContainText('已启用');await form(page,'release');await submit(page).click();await expect(kill(page)).toContainText('未启用');await expect(page.getByRole('region',{name:'风险规则'})).not.toContainText('AccountKill');expect(writes().map(r=>r.status)).toEqual([200,200]);});
> 14 | test('UI501 committed response lost locks original request; refresh does not replay; explicit recovery reuses key/body/proof',async({page})=>{await open(page);await form(page);fault({drop:true});await submit(page).click();await expect(page.getByRole('alert').filter({hasText:'操作结果未知'})).toBeVisible();await expect(page.getByLabel('操作原因',{exact:true})).toBeDisabled();expect(writes()).toHaveLength(1);await page.getByRole('button',{name:'重新读取组合与风险',exact:true}).click();await expect(kill(page)).toContainText('已启用');expect(writes()).toHaveLength(1);await page.getByRole('button',{name:'显式重试原风险操作',exact:true}).click();await expect(page.getByRole('region',{name:'风险操作回执'})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'操作结果未知'})).toHaveCount(0);expect(writes()).toHaveLength(2);expect(writes()[1].keyHash).toBe(writes()[0].keyHash);expect(writes()[1].bodyHash).toBe(writes()[0].bodyHash);expect(networkRows().filter(r=>r.path==='/v1/auth/mfa/challenges')).toHaveLength(1);});
     |                                                                                                                                                                                                                                                                                                                                                                 ^ Error: expect(locator).toBeDisabled() failed
  15 | test('UI501 explicit stale snapshot blocks every write; manual re-read restores valid data',async({page})=>{fault({stale:true});await page.goto('/portfolio');await authorized(page);await expect(kill(page)).toContainText('stale：true');await expect(submit(page)).toBeDisabled();await expect(page.getByLabel('MFA 验证码',{exact:true})).toBeDisabled();expect(networkRows().some(r=>r.method==='POST')).toBe(false);fault({});await page.getByRole('button',{name:'重新读取组合与风险',exact:true}).click();await expect(kill(page)).toContainText('数据有效');expect(writes()).toHaveLength(0);});
  16 | test('UI501 portfolio stream disconnect freezes last fact and blocks writes until explicit recovery',async({page})=>{await open(page);fault({streamError:true});await expect(kill(page)).toContainText('所有写操作已阻断');await expect(page.getByRole('table',{name:'账户仓位'})).toContainText('BTCUSDT');await expect(submit(page)).toBeDisabled();fault({});await page.getByRole('button',{name:'重新读取组合与风险',exact:true}).click();await expect(kill(page)).toContainText('数据有效');expect(writes()).toHaveLength(0);});
  17 | test('UI501 viewer cannot obtain portfolio and a foreign account payload is rejected without write',async({page})=>{fault({readonly:true});await page.goto('/portfolio');await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await expect(kill(page)).toContainText('未知');expect(networkRows().some(r=>r.path==='/v1/portfolio')).toBe(false);fault({foreign:true});await page.getByRole('button',{name:'重新核对访问权限',exact:true}).click();await authorized(page);await expect(submit(page)).toBeDisabled();await expect(page.getByRole('table',{name:'账户仓位'})).toHaveCount(0);expect(writes()).toHaveLength(0);});
  18 | test('UI501 offline clears memory and kill certainty, reconnection requires explicit C01 revalidation',async({page,context})=>{await open(page);await context.setOffline(true);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await expect(kill(page)).toContainText('未知');await expect(page.getByRole('table',{name:'账户仓位'})).toHaveCount(0);await context.setOffline(false);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await page.getByRole('button',{name:'重新核对访问权限',exact:true}).click();await authorized(page);await expect(kill(page)).toContainText('数据有效');expect(writes()).toHaveLength(0);});
  19 | test('UI501 revoked reference session clears portfolio before manual access recovery',async({page})=>{await open(page);expect((await control('/v1/auth/logout',undefined,undefined,{method:'POST'})).status).toBe(204);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await expect(kill(page)).toContainText('未知');await expect(page.getByRole('table',{name:'账户仓位'})).toHaveCount(0);expect(writes()).toHaveLength(0);});
  20 | test('UI501 basic dark/light desktop/mobile visual, keyboard and accessibility review',async({page},info)=>{const scans=[];for(const theme of ['dark','light'] as const){await page.emulateMedia({colorScheme:theme});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await open(page);await page.getByLabel('操作原因',{exact:true}).focus();await expect(page.getByLabel('操作原因',{exact:true})).toBeFocused();await page.getByRole('main').evaluate(el=>{el.scrollTop=0;});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const scan=await new AxeBuilder({page}).analyze();scans.push({theme,width,violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath('ui501-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));expect(scan.violations).toEqual([]);await page.screenshot({path:info.outputPath(`portfolio-${theme}-${width}.png`),fullPage:true});}}});
  21 | 
```