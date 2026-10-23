# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p09.spec.ts >> P09 actual list/detail deep reload and audit references retain non-executable facts
- Location: tests/e2e/ui-p09.spec.ts:10:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('proposal-detail')
Expected substring: "证据引用"
Received string:    "TradeProposal / a9894c67-d61e-474d-8d30-7d2713eeef82BTCUSDT · BUY 建议activeexecutable=falseversion 000:57 后失效复制ID提醒关闭详情ⓘ这是交易建议，不是订单executable=false · 建议不会直接提交到venue。请先读取上下文，再请求风险评估。请求风险评估建议摘要Account44444444-4444-4444-8444-444444444444SymbolBTCUSDTActionBUYConfidence0.5Quantity1500Notional150000 币种未提供Limit price未提供Correlation ID01a16958-9614-7311-8cbf-a366d83c8351Created at未提供Context hash请显式读取风险上下文ⓘ 这是不可执行建议；Signal生成时间不作为Proposal创建时间。SignalSignal IDcee3fb8a-26bf-49cd-bb55-aee1ac82963cDirectionLONGStrength / Confidence0.5 / 0.5Generated at2026-10-23 15:19:34.679 UTCValid until2026-10-23 15:20:35.679 UTCStrategyRelease01a16958-9610-7742-9d91-79404f1490d7论证owned fixture反方观点synthetic counter view△ 反方观点不会被隐藏。风险评估将重新读取最新上下文。状态时间线 · 证据链当前建议状态 active · version 0。历史记录只取服务端授权链；不补造创建、证据关联或风险通过事件。查看证据链核查建议审计链组合与风险上下文ModepaperAccount NAV未提供当前敞口 / 预警 / 限额未提供预检（仅预览）未读取风险数据 asOf未知预检到期 / 版本未知当前命中：未知刷新风险上下文预检未核验、陈旧或当前拒绝，禁止评估 · 建议状态流已核验预检不代表评估已通过。过期、陈旧或拒绝时禁止评估，变化后须重新审阅。不可变输入StrategyRelease01a16958-9610-7742-9d91-79404f1490d7Signalcee3fb8a-26bf-49cd-bb55-aee1ac82963cEvidence refs1 个来源引用DataSnapshot / 输入哈希未提供发布批准 / License状态未提供只显示来源引用；不据此推断发布许可、签名或可执行性。证据ID标题 / SourceTimestamp / Version01a16958-9613-78e2-8eab-4a0e230a0323类型与标题未提供未提供Evidence refs: 1。来源未声明证据类型，无法定位内容；通用UUID不作为Artifact或审计eventId跳转。失效行为说明00:57 后失效2026-10-23 15:20:35.679 UTCProposal或Signal过期后仍可核查事实，但禁止风险评估及原POST重试。数据陈旧或上下文拒绝时同样禁用。"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByTestId('proposal-detail')
    8 × locator resolved to <section aria-label="建议详情" class="p09-detail-body" data-testid="proposal-detail">…</section>
      - unexpected value "TradeProposal / a9894c67-d61e-474d-8d30-7d2713eeef82BTCUSDT · BUY 建议activeexecutable=falseversion 001:01 后失效复制ID提醒关闭详情ⓘ这是交易建议，不是订单executable=false · 建议不会直接提交到venue。请先读取上下文，再请求风险评估。请求风险评估建议摘要Account44444444-4444-4444-8444-444444444444SymbolBTCUSDTActionBUYConfidence0.5Quantity1500Notional150000 币种未提供Limit price未提供Correlation ID01a16958-9614-7311-8cbf-a366d83c8351Created at未提供Context hash请显式读取风险上下文ⓘ 这是不可执行建议；Signal生成时间不作为Proposal创建时间。SignalSignal IDcee3fb8a-26bf-49cd-bb55-aee1ac82963cDirectionLONGStrength / Confidence0.5 / 0.5Generated at2026-10-23 15:19:34.679 UTCValid until2026-10-23 15:20:35.679 UTCStrategyRelease01a16958-9610-7742-9d91-79404f1490d7论证owned fixture反方观点synthetic counter view△ 反方观点不会被隐藏。风险评估将重新读取最新上下文。状态时间线 · 证据链当前建议状态 active · version 0。历史记录只取服务端授权链；不补造创建、证据关联或风险通过事件。查看证据链核查建议审计链组合与风险上下文ModepaperAccount NAV未提供当前敞口 / 预警 / 限额未提供预检（仅预览）未读取风险数据 asOf未知预检到期 / 版本未知当前命中：未知刷新风险上下文预检未核验、陈旧或当前拒绝，禁止评估 · 建议状态流已核验预检不代表评估已通过。过期、陈旧或拒绝时禁止评估，变化后须重新审阅。不可变输入StrategyRelease01a16958-9610-7742-9d91-79404f1490d7Signalcee3fb8a-26bf-49cd-bb55-aee1ac82963cEvidence refs1 个来源引用DataSnapshot / 输入哈希未提供发布批准 / License状态未提供只显示来源引用；不据此推断发布许可、签名或可执行性。证据ID标题 / SourceTimestamp / Version01a16958-9613-78e2-8eab-4a0e230a0323类型与标题未提供未提供Evidence refs: 1。来源未声明证据类型，无法定位内容；通用UUID不作为Artifact或审计eventId跳转。失效行为说明01:01 后失效2026-10-23 15:20:35.679 UTCProposal或Signal过期后仍可核查事实，但禁止风险评估及原POST重试。数据陈旧或上下文拒绝时同样禁用。"
    4 × locator resolved to <section aria-label="建议详情" class="p09-detail-body" data-testid="proposal-detail">…</section>
      - unexpected value "TradeProposal / a9894c67-d61e-474d-8d30-7d2713eeef82BTCUSDT · BUY 建议activeexecutable=falseversion 000:59 后失效复制ID提醒关闭详情ⓘ这是交易建议，不是订单executable=false · 建议不会直接提交到venue。请先读取上下文，再请求风险评估。请求风险评估建议摘要Account44444444-4444-4444-8444-444444444444SymbolBTCUSDTActionBUYConfidence0.5Quantity1500Notional150000 币种未提供Limit price未提供Correlation ID01a16958-9614-7311-8cbf-a366d83c8351Created at未提供Context hash请显式读取风险上下文ⓘ 这是不可执行建议；Signal生成时间不作为Proposal创建时间。SignalSignal IDcee3fb8a-26bf-49cd-bb55-aee1ac82963cDirectionLONGStrength / Confidence0.5 / 0.5Generated at2026-10-23 15:19:34.679 UTCValid until2026-10-23 15:20:35.679 UTCStrategyRelease01a16958-9610-7742-9d91-79404f1490d7论证owned fixture反方观点synthetic counter view△ 反方观点不会被隐藏。风险评估将重新读取最新上下文。状态时间线 · 证据链当前建议状态 active · version 0。历史记录只取服务端授权链；不补造创建、证据关联或风险通过事件。查看证据链核查建议审计链组合与风险上下文ModepaperAccount NAV未提供当前敞口 / 预警 / 限额未提供预检（仅预览）未读取风险数据 asOf未知预检到期 / 版本未知当前命中：未知刷新风险上下文预检未核验、陈旧或当前拒绝，禁止评估 · 建议状态流已核验预检不代表评估已通过。过期、陈旧或拒绝时禁止评估，变化后须重新审阅。不可变输入StrategyRelease01a16958-9610-7742-9d91-79404f1490d7Signalcee3fb8a-26bf-49cd-bb55-aee1ac82963cEvidence refs1 个来源引用DataSnapshot / 输入哈希未提供发布批准 / License状态未提供只显示来源引用；不据此推断发布许可、签名或可执行性。证据ID标题 / SourceTimestamp / Version01a16958-9613-78e2-8eab-4a0e230a0323类型与标题未提供未提供Evidence refs: 1。来源未声明证据类型，无法定位内容；通用UUID不作为Artifact或审计eventId跳转。失效行为说明00:59 后失效2026-10-23 15:20:35.679 UTCProposal或Signal过期后仍可核查事实，但禁止风险评估及原POST重试。数据陈旧或上下文拒绝时同样禁用。"
    2 × locator resolved to <section aria-label="建议详情" class="p09-detail-body" data-testid="proposal-detail">…</section>
      - unexpected value "TradeProposal / a9894c67-d61e-474d-8d30-7d2713eeef82BTCUSDT · BUY 建议activeexecutable=falseversion 000:57 后失效复制ID提醒关闭详情ⓘ这是交易建议，不是订单executable=false · 建议不会直接提交到venue。请先读取上下文，再请求风险评估。请求风险评估建议摘要Account44444444-4444-4444-8444-444444444444SymbolBTCUSDTActionBUYConfidence0.5Quantity1500Notional150000 币种未提供Limit price未提供Correlation ID01a16958-9614-7311-8cbf-a366d83c8351Created at未提供Context hash请显式读取风险上下文ⓘ 这是不可执行建议；Signal生成时间不作为Proposal创建时间。SignalSignal IDcee3fb8a-26bf-49cd-bb55-aee1ac82963cDirectionLONGStrength / Confidence0.5 / 0.5Generated at2026-10-23 15:19:34.679 UTCValid until2026-10-23 15:20:35.679 UTCStrategyRelease01a16958-9610-7742-9d91-79404f1490d7论证owned fixture反方观点synthetic counter view△ 反方观点不会被隐藏。风险评估将重新读取最新上下文。状态时间线 · 证据链当前建议状态 active · version 0。历史记录只取服务端授权链；不补造创建、证据关联或风险通过事件。查看证据链核查建议审计链组合与风险上下文ModepaperAccount NAV未提供当前敞口 / 预警 / 限额未提供预检（仅预览）未读取风险数据 asOf未知预检到期 / 版本未知当前命中：未知刷新风险上下文预检未核验、陈旧或当前拒绝，禁止评估 · 建议状态流已核验预检不代表评估已通过。过期、陈旧或拒绝时禁止评估，变化后须重新审阅。不可变输入StrategyRelease01a16958-9610-7742-9d91-79404f1490d7Signalcee3fb8a-26bf-49cd-bb55-aee1ac82963cEvidence refs1 个来源引用DataSnapshot / 输入哈希未提供发布批准 / License状态未提供只显示来源引用；不据此推断发布许可、签名或可执行性。证据ID标题 / SourceTimestamp / Version01a16958-9613-78e2-8eab-4a0e230a0323类型与标题未提供未提供Evidence refs: 1。来源未声明证据类型，无法定位内容；通用UUID不作为Artifact或审计eventId跳转。失效行为说明00:57 后失效2026-10-23 15:20:35.679 UTCProposal或Signal过期后仍可核查事实，但禁止风险评估及原POST重试。数据陈旧或上下文拒绝时同样禁用。"

```

```yaml
- region "建议详情":
  - paragraph: TradeProposal / a9894c67-d61e-474d-8d30-7d2713eeef82
  - heading "BTCUSDT · BUY 建议" [level=2]
  - text: active executable=false version 0 00:57 后失效
  - button "复制ID"
  - button "提醒" [disabled]
  - link "关闭详情":
    - /url: /proposals
  - region "不可执行声明":
    - heading "这是交易建议，不是订单" [level=2]
    - paragraph: executable=false · 建议不会直接提交到venue。请先读取上下文，再请求风险评估。
    - button "请求风险评估" [disabled]
  - region "建议摘要":
    - heading "建议摘要" [level=3]
    - term: Account
    - definition: 44444444-4444-4444-8444-444444444444
    - term: Symbol
    - definition: BTCUSDT
    - term: Action
    - definition: BUY
    - term: Confidence
    - definition: "0.5"
    - term: Quantity
    - definition: "1500"
    - term: Notional
    - definition: 150000 币种未提供
    - term: Limit price
    - definition: 未提供
    - term: Correlation ID
    - definition: 01a16958-9614-7311-8cbf-a366d83c8351
    - term: Created at
    - definition: 未提供
    - term: Context hash
    - definition: 请显式读取风险上下文
    - paragraph: ⓘ 这是不可执行建议；Signal生成时间不作为Proposal创建时间。
  - region "Signal":
    - heading "Signal" [level=3]
    - term: Signal ID
    - definition: cee3fb8a-26bf-49cd-bb55-aee1ac82963c
    - term: Direction
    - definition: LONG
    - term: Strength / Confidence
    - definition: 0.5 / 0.5
    - term: Generated at
    - definition: 2026-10-23 15:19:34.679 UTC
    - term: Valid until
    - definition: 2026-10-23 15:20:35.679 UTC
    - term: StrategyRelease
    - definition: 01a16958-9610-7742-9d91-79404f1490d7
  - region "论证与反方观点":
    - heading "论证" [level=3]
    - paragraph: owned fixture
    - heading "反方观点" [level=3]
    - list:
      - listitem: synthetic counter view
    - paragraph: △ 反方观点不会被隐藏。风险评估将重新读取最新上下文。
  - region "状态时间线与证据链":
    - heading "状态时间线 · 证据链" [level=3]
    - paragraph: 当前建议状态 active · version 0。历史记录只取服务端授权链；不补造创建、证据关联或风险通过事件。
    - button "查看证据链"
    - link "核查建议审计链":
      - /url: /audit?correlationId=01a16958-9614-7311-8cbf-a366d83c8351
  - region "风险评估":
    - heading "组合与风险上下文" [level=3]
    - term: Mode
    - definition: paper
    - term: Account NAV
    - definition: 未提供
    - term: 当前敞口 / 预警 / 限额
    - definition: 未提供
    - term: 预检（仅预览）
    - definition: 未读取
    - term: 风险数据 asOf
    - definition: 未知
    - term: 预检到期 / 版本
    - definition: 未知
    - paragraph: 当前命中：未知
    - button "刷新风险上下文"
    - status: 预检未核验、陈旧或当前拒绝，禁止评估 · 建议状态流已核验
    - paragraph: 预检不代表评估已通过。过期、陈旧或拒绝时禁止评估，变化后须重新审阅。
  - region "不可变输入":
    - heading "不可变输入" [level=3]
    - term: StrategyRelease
    - definition: 01a16958-9610-7742-9d91-79404f1490d7
    - term: Signal
    - definition: cee3fb8a-26bf-49cd-bb55-aee1ac82963c
    - term: Evidence refs
    - definition: 1 个来源引用
    - term: DataSnapshot / 输入哈希
    - definition: 未提供
    - term: 发布批准 / License状态
    - definition: 未提供
    - paragraph: 只显示来源引用；不据此推断发布许可、签名或可执行性。
  - region "证据引用":
    - heading "证据" [level=3]
    - region "证据引用表格":
      - table:
        - rowgroup:
          - row "ID 标题 / Source Timestamp / Version":
            - columnheader "ID"
            - columnheader "标题 / Source"
            - columnheader "Timestamp / Version"
        - rowgroup:
          - row "01a16958-9613-78e2-8eab-4a0e230a0323 类型与标题未提供 未提供":
            - cell "01a16958-9613-78e2-8eab-4a0e230a0323"
            - cell "类型与标题未提供"
            - cell "未提供"
    - paragraph: "Evidence refs: 1。来源未声明证据类型，无法定位内容；通用UUID不作为Artifact或审计eventId跳转。"
  - region "失效行为说明":
    - heading "失效行为说明" [level=3]
    - paragraph: 00:57 后失效
    - time: 2026-10-23 15:20:35.679 UTC
    - paragraph: Proposal或Signal过期后仍可核查事实，但禁止风险评估及原POST重试。数据陈旧或上下文拒绝时同样禁用。
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import {writeFile} from 'node:fs/promises';
  4  | import {installReferenceHooks,authorized,networkRows,fault,control} from './fixtures/ui-p09-reference';
  5  | installReferenceHooks();
  6  | const writes=()=>networkRows().filter(r=>r.method==='POST'&&r.path.endsWith('/risk-evaluations')&&!r.control),detail=(p:Page)=>p.getByTestId('proposal-detail'),evaluate=(p:Page)=>p.getByRole('button',{name:'请求风险评估',exact:true});
  7  | async function open(p:Page){await p.goto('/proposals');await authorized(p);await expect(p.getByTestId('proposal-row')).toHaveCount(1);}
  8  | async function choose(p:Page){await p.getByRole('link',{name:'查看建议',exact:true}).first().click();await expect(detail(p)).toContainText('executable=false');await expect(p.getByRole('button',{name:'刷新风险上下文',exact:true})).toBeEnabled();}
  9  | async function prepare(p:Page){await p.getByRole('button',{name:'刷新风险上下文',exact:true}).click();await expect(p.getByRole('status').filter({hasText:'当前预检有效'})).toBeVisible();}
> 10 | test('P09 actual list/detail deep reload and audit references retain non-executable facts',async({page})=>{await open(page);await choose(page);const path=new URL(page.url()).pathname;await expect(detail(page)).toContainText('executable=false');await expect(detail(page)).toContainText('反方观点');await expect(detail(page)).toContainText('Signal');await expect(detail(page)).toContainText('证据引用');await expect(detail(page).getByRole('link',{name:'核查建议审计链'})).toHaveAttribute('href',/^\/audit\?correlationId=[a-f0-9-]{36}$/);await page.reload();await authorized(page);await expect(detail(page)).toContainText('executable=false');await expect(page).toHaveURL(new RegExp(path+'$'));await page.getByRole('navigation',{name:'Proposal 导航'}).getByRole('link',{name:'Proposals',exact:true}).click();await expect(detail(page)).toHaveCount(0);await page.goBack();await expect(detail(page)).toContainText('executable=false');expect(writes()).toHaveLength(0);await expect(page.getByRole('button',{name:/下单|批准|提交命令/})).toHaveCount(0);});
     |                                                                                                                                                                                                                                                                                                                                                                                    ^ Error: expect(locator).toContainText(expected) failed
  11 | test('P09 actual query filters and empty state stay server backed',async({page})=>{await open(page);await page.getByLabel('Symbol',{exact:true}).fill('ETHUSDT');await page.getByRole('button',{name:'查询建议',exact:true}).click();await expect(page.getByText('当前查询无建议。建议来自已发布策略的授权研究结果，可核查研究任务或调整筛选。',{exact:true})).toBeVisible();await page.getByRole('button',{name:'清除筛选',exact:true}).click();await expect(page.getByTestId('proposal-row')).toHaveCount(1);await page.getByLabel('状态',{exact:true}).selectOption('expired');await page.getByRole('button',{name:'查询建议',exact:true}).click();await expect(page.getByTestId('proposal-row')).toHaveCount(0);expect(networkRows().some(r=>r.path==='/v1/proposals'&&r.query.status==='expired')).toBe(true);expect(writes()).toHaveLength(0);});
  12 | test('P09 fresh server preflight, exact If-Match/hash request and 202 receipt never create risk allow or order',async({page})=>{await open(page);await choose(page);await expect(evaluate(page)).toBeDisabled();await prepare(page);await expect(detail(page)).toContainText('approval_required');await evaluate(page).click();await expect(page.getByRole('region',{name:'风险评估受理回执'})).toContainText('202 / accepted 仅是受理回执');await expect(detail(page)).toContainText('awaiting_approval');await expect(evaluate(page)).toBeDisabled();expect(writes()).toHaveLength(1);expect(writes()[0].version).toBe('0');expect(writes()[0].status).toBe(202);await expect(page.getByTestId('proposal-permanent-banner')).toContainText('executable=false');expect(networkRows().some(r=>r.path==='/v1/commands')).toBe(false);});
  13 | test('P09 committed acceptance response lost requires read and explicit original intent recovery',async({page})=>{await open(page);await choose(page);await prepare(page);fault({drop:true});await evaluate(page).click();await expect(page.getByRole('alert').filter({hasText:'风险评估结果未知'})).toBeVisible();await expect(evaluate(page)).toBeDisabled();await expect(page.getByRole('button',{name:'显式重试原评估请求'})).toBeDisabled();await page.getByRole('button',{name:'刷新风险上下文'}).click();await expect(detail(page)).toContainText('awaiting_approval');expect(writes()).toHaveLength(1);await page.getByRole('button',{name:'显式重试原评估请求'}).click();await expect(page.getByRole('region',{name:'风险评估受理回执'})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'风险评估结果未知'})).toHaveCount(0);expect(writes()).toHaveLength(2);expect(writes()[0].keyHash).toBe(writes()[1].keyHash);expect(writes()[0].bodyHash).toBe(writes()[1].bodyHash);expect(writes()[0].version).toBe(writes()[1].version);});
  14 | test('P09 expired Proposal stays readable but cannot read evaluation context or post an assessment',async({page})=>{fault({expired:true});await open(page);await page.getByRole('link',{name:'查看建议',exact:true}).click();await expect(detail(page)).toContainText('已过期，禁止评估');await expect(page.getByRole('button',{name:'刷新风险上下文'})).toBeDisabled();await expect(evaluate(page)).toBeDisabled();expect(networkRows().some(r=>r.path==='/v1/trade-preflight')).toBe(false);expect(writes()).toHaveLength(0);await expect(page.getByTestId('proposal-permanent-banner')).toBeInViewport();});
  15 | test('P09 stale preflight disables writes until explicit current-context refresh',async({page})=>{await open(page);await choose(page);fault({stale:true});await page.getByRole('button',{name:'刷新风险上下文'}).click();await expect(page.getByRole('status').filter({hasText:'预检未核验、陈旧或当前拒绝'})).toBeVisible();await expect(evaluate(page)).toBeDisabled();fault({});await prepare(page);await expect(evaluate(page)).toBeEnabled();expect(writes()).toHaveLength(0);});
  16 | test('P09 version conflict is shown in place, never overwritten or silently retried',async({page})=>{await open(page);await choose(page);await prepare(page);fault({conflict:true});await evaluate(page).click();await expect(page.locator('.proposal-error[role=alert]')).toContainText('版本冲突');await expect(page.locator('.proposal-error[role=alert]')).toContainText('当前服务端版本：1');await expect(page.locator('.proposal-error[role=alert]')).toContainText('aaaaaaaa-1111-4111-8111-111111111111');await expect(page.getByText('private SQL',{exact:false})).toHaveCount(0);await expect(evaluate(page)).toBeDisabled();expect(writes()).toHaveLength(1);fault({});await prepare(page);expect(writes()).toHaveLength(1);await evaluate(page).click();await expect(page.getByRole('region',{name:'风险评估受理回执'})).toBeVisible();expect(writes()).toHaveLength(2);expect(writes()[0].keyHash).not.toBe(writes()[1].keyHash);});
  17 | test('P09 actual non-originator cannot request evaluation; rejection leaves proposal non-executable',async({page})=>{fault({actor:'session-approver'});await open(page);await choose(page);await prepare(page);await evaluate(page).click();await expect(page.locator('.proposal-error[role=alert]')).toContainText('服务端拒绝当前操作权限');await expect(detail(page)).toContainText('executable=false');expect(writes()[0].status).toBe(403);await expect(page.getByRole('region',{name:'风险评估受理回执'})).toHaveCount(0);});
  18 | test('P09 actual current kill risk denial is a preflight refusal with zero C07 writes',async({page})=>{await open(page);await choose(page);const mfa=await control('/v1/auth/mfa/challenges',{purpose:'security_change',code:'123456'},undefined,{method:'POST',session:'session-owner'}),grant=await control('/v1/auth/reauth',{challengeRef:mfa.body.challengeRef},undefined,{method:'POST',session:'session-owner'});expect((await control('/v1/risk/kill-switch/engage',{accountId:'44444444-4444-4444-8444-444444444444',reason:'owned UI502 refusal test',confirmPhrase:'ENGAGE KILL SWITCH',mfaChallengeRef:mfa.body.challengeRef,reauthTokenRef:grant.body.reauthTokenRef},undefined,{method:'POST',session:'session-owner'})).status).toBe(200);await page.getByRole('button',{name:'刷新风险上下文'}).click();await expect(detail(page)).toContainText('deny');await expect(detail(page)).toContainText('AccountKill');await expect(evaluate(page)).toBeDisabled();expect(writes()).toHaveLength(0);});
  19 | test('P09 stream disconnect freezes detail and blocks assessment until manual recovery',async({page})=>{await open(page);await choose(page);await prepare(page);fault({streamError:true});await expect(page.locator('.proposal-error[role=alert]')).toContainText('aaaaaaaa-1111-4111-8111-111111111111');await expect(detail(page)).toContainText('executable=false');await expect(evaluate(page)).toBeDisabled();fault({});await prepare(page);await expect(evaluate(page)).toBeEnabled();expect(writes()).toHaveLength(0);});
  20 | test('P09 offline clears sensitive facts and retains last sync; online never replays an assessment',async({page,context})=>{await open(page);await choose(page);await prepare(page);await context.setOffline(true);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await expect(page.getByText(/^最后同步时间：/)).toBeVisible();await expect(detail(page)).toHaveCount(0);await expect(page.getByText('这是交易建议，不是订单 · executable=false',{exact:true})).toBeVisible();await context.setOffline(false);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await page.getByRole('button',{name:'重新核对访问权限'}).click();await authorized(page);await expect(detail(page)).toContainText('executable=false');await expect(evaluate(page)).toBeDisabled();expect(writes()).toHaveLength(0);});
  21 | test('P09 unauthorized/unknown/malformed resources and executable payload never reach evaluation',async({page})=>{fault({readonly:true});await page.goto('/proposals');await expect(page.locator('[data-route-access="denied"]')).toBeVisible();expect(networkRows().some(r=>r.path==='/v1/proposals')).toBe(false);fault({});await page.goto('/proposals/aaaaaaaa-1111-4111-8111-111111111111');await authorized(page);await expect(detail(page)).toContainText('建议不存在、无资源权限或读取未完成');expect(networkRows().some(r=>r.path==='/v1/proposals/aaaaaaaa-1111-4111-8111-111111111111'&&r.status===404)).toBe(true);expect((await page.goto('/proposals/nope'))?.status()).toBe(404);await page.goto('/proposals?accountId=evil');await expect(page.getByRole('heading',{name:'Proposal 引用无效'})).toBeVisible();fault({executable:true});await page.goto('/proposals');await authorized(page);await expect(page.getByTestId('proposal-row')).toHaveCount(0);expect(writes()).toHaveLength(0);});
  22 | test('P09 loading and read-error states do not synthesize proposals or overwrite last list',async({page})=>{fault({slow:true});await page.goto('/proposals');await authorized(page);await expect(page.getByText('正在读取建议列表…',{exact:true})).toBeVisible();await expect(page.getByTestId('proposal-row')).toHaveCount(1);fault({listError:true});await page.getByRole('button',{name:'查询建议',exact:true}).click();await expect(page.locator('.proposal-error[role=alert]')).toContainText('aaaaaaaa-1111-4111-8111-111111111111');await expect(page.getByTestId('proposal-row')).toHaveCount(1);expect(writes()).toHaveLength(0);});
  23 | test('P09 session revocation clears proposal and prepared context immediately',async({page})=>{await open(page);await choose(page);await prepare(page);expect((await control('/v1/auth/logout',undefined,undefined,{method:'POST'})).status).toBe(204);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await expect(detail(page)).toHaveCount(0);await expect(page.getByRole('button',{name:'请求风险评估'})).toHaveCount(0);expect(writes()).toHaveLength(0);});
  24 | test('P09 local categories search release and expiry sort never claim global counts or dispatch writes',async({page})=>{await open(page);await expect(page.getByTestId('p09-list')).toContainText('当前载入 1 条');await page.getByRole('button',{name:'Expired 0',exact:true}).click();await expect(page.getByText('当前载入建议中没有匹配项。请清除分类、搜索或发布筛选。',{exact:true})).toBeVisible();await page.getByRole('button',{name:'全部 1',exact:true}).click();await page.getByLabel('搜索当前载入建议',{exact:true}).fill('DOES-NOT-EXIST');await expect(page.getByTestId('proposal-row')).toHaveCount(0);await page.getByLabel('搜索当前载入建议',{exact:true}).fill('btc');await expect(page.getByTestId('proposal-row')).toHaveCount(1);await page.getByLabel('失效时间排序',{exact:true}).selectOption('expiry:desc');await page.getByLabel('策略发布',{exact:true}).selectOption({index:1});await expect(page.getByTestId('proposal-row')).toHaveCount(1);expect(writes()).toHaveLength(0);});
  25 | test('P09 actual C10 unavailable before assessment then real accepted event is shown without fabricated approval',async({page})=>{await open(page);await choose(page);const chain=page.getByRole('region',{name:'状态时间线与证据链',exact:true});await chain.getByRole('button',{name:'查看证据链',exact:true}).click();await expect(chain.getByRole('alert')).toContainText('当前关联未返回可访问证据链');await prepare(page);await evaluate(page).click();await expect(page.getByRole('region',{name:'风险评估受理回执'})).toBeVisible();await chain.getByRole('button',{name:'查看证据链',exact:true}).click();await expect(chain).toContainText('当前授权范围完整');await expect(chain.locator('.p09-timeline')).toContainText('/risk-evaluations');await expect(chain).toContainText('不代表全局因果');await expect(chain.getByRole('link')).toHaveCount(1);expect(networkRows().filter(r=>r.path.startsWith('/v1/audit/evidence-chains/')).map(r=>r.status)).toEqual([404,200]);expect(writes()).toHaveLength(1);});
  26 | test('P09 audit capability is separate and cannot be guessed from execution capability',async({page})=>{fault({noAudit:true});await open(page);await choose(page);await expect(page.getByRole('button',{name:'查看证据链',exact:true})).toBeDisabled();await expect(page.getByText('缺少审计权限或当前建议关联引用，无法读取证据链。',{exact:true})).toBeVisible();expect(networkRows().some(r=>r.path.startsWith('/v1/audit/'))).toBe(false);expect(writes()).toHaveLength(0);});
  27 | test('P09 C10 denial clears chain and shows safe error while immutable suggestion stays readable',async({page})=>{await open(page);await choose(page);fault({auditDenied:true});await page.getByRole('button',{name:'查看证据链',exact:true}).click();const chain=page.getByRole('region',{name:'状态时间线与证据链',exact:true});await expect(chain.getByRole('alert')).toContainText('无当前证据链访问权限');await expect(chain.getByRole('alert')).toContainText('aaaaaaaa-1111-4111-8111-111111111111');await expect(page.getByText('private SQL',{exact:false})).toHaveCount(0);await expect(detail(page)).toContainText('executable=false');expect(writes()).toHaveLength(0);});
  28 | test('P09 forged correlation or expired C10 node never becomes displayed evidence',async({page})=>{await open(page);await choose(page);await prepare(page);await evaluate(page).click();await expect(page.getByRole('region',{name:'风险评估受理回执'})).toBeVisible();for(const probe of [{chainForeign:true},{chainExpired:true}]){fault(probe);await page.getByRole('button',{name:'查看证据链',exact:true}).click();const chain=page.getByRole('region',{name:'状态时间线与证据链',exact:true});await expect(chain.getByRole('alert')).toContainText('证据链读取失败或已失效');await expect(chain.locator('.p09-timeline')).toHaveCount(0);}expect(writes()).toHaveLength(1);});
  29 | test('P09 detail mobile focus close history and keyboard navigation keep permanent non-executable state',async({page})=>{await page.setViewportSize({width:390,height:1000});await open(page);await choose(page);const heading=page.locator('#proposal-title');await expect(heading).toBeFocused();const box=await heading.boundingBox();expect(box!.y).toBeGreaterThanOrEqual(54);expect(box!.y).toBeLessThan(300);await expect(page.getByTestId('proposal-permanent-banner')).toBeInViewport();await page.getByRole('link',{name:'关闭详情',exact:true}).click();await expect(detail(page)).toHaveCount(0);await page.goBack();await expect(detail(page)).toContainText('executable=false');await expect(heading).toBeFocused();expect(writes()).toHaveLength(0);});
  30 | test('P09 design-aligned list/detail dark-light desktop tablet mobile visuals geometry and axe',async({page},info)=>{test.setTimeout(120000);const scans=[],geometry=[];for(const view of ['list','detail'])for(const theme of ['dark','light']as const)for(const width of [1672,1024,390]){await page.emulateMedia({colorScheme:theme});await page.setViewportSize({width,height:1000});await open(page);if(view==='detail')await choose(page);if(width>=1100)await page.getByTestId('p09-detail-pane').evaluate(el=>{el.scrollTop=0;});else if(view==='list')await page.getByRole('main').evaluate(el=>{el.scrollTop=0;});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByTestId('proposal-permanent-banner')).toBeInViewport();const scan=await new AxeBuilder({page}).analyze();scans.push({view,theme,width,violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath('p09-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));expect(scan.violations).toEqual([]);const list=await page.getByTestId('p09-list').boundingBox(),pane=await page.getByTestId('p09-detail-pane').boundingBox();geometry.push({view,theme,width,list,detail:pane});if(width===1672)expect(list!.x+list!.width).toBeLessThanOrEqual(pane!.x+1);else expect(pane!.y).toBeGreaterThanOrEqual(list!.y+list!.height-1);await page.screenshot({path:info.outputPath(`p09-${view}-${theme}-${width}.png`),fullPage:true});}await writeFile(info.outputPath('p09-geometry.json'),JSON.stringify(geometry,null,2));});
  31 | 
```