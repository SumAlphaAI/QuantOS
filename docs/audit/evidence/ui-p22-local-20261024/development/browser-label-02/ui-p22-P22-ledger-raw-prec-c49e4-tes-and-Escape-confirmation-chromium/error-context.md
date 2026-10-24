# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p22.spec.ts >> P22 ledger raw precision side filters disabled unsupported writes and Escape confirmation
- Location: tests/e2e/ui-p22.spec.ts:20:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  getByText('核对账户、日期、来源 hash、差异原值及相关 Order / Fill。', { exact: true })
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('核对账户、日期、来源 hash、差异原值及相关 Order / Fill。', { exact: true })
    13 × locator resolved to <li>核对账户、日期、来源 hash、差异原值及相关 Order / Fill。</li>
       - unexpected value "hidden"

```

```yaml
- link "跳至正文":
  - /url: "#_r_9_"
- banner:
  - button "折叠侧栏" [expanded]: SUMALPHA
  - text: ▣ 33333333-3333-4333-… 44444444-4444-4444-… SHADOW
  - textbox "全局搜索" [disabled]:
    - /placeholder: 搜索  ⌘K
  - button "通知" [disabled]: ♧
  - link "帮助":
    - /url: "#p22-runbook"
    - text: "?"
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
  - link "↳ 对账":
    - /url: /reconciliation
- main:
  - link "Orders":
    - /url: /orders
  - text: /
  - link "Reconciliation":
    - /url: /reconciliation
  - text: / 7b461e3a-ddfa-4299-8c70…
  - heading "Reconciliation" [level=1]
  - paragraph: 核对订单、成交、费用与账本；待处理差异不会被视为已确认收益。
  - button "查看运行记录"
  - button "刷新运行列表"
  - link "打开 Runbook":
    - /url: "#p22-runbook"
  - button "切换主题"
  - strong: 当前运行结果为 Provisional，不能视为最终对账完成。
  - text: 报告差异 1 项 · 当前返回 1 项 · 当前事实已核对
  - link "查看影响范围 →":
    - /url: "#p22-related"
  - region "对账上下文":
    - text: Account
    - textbox "对账账户": 44444444-4444-4444-8444-444444444444
    - text: Venue
    - textbox "对账 Venue": 来源未提供
    - text: Reconciliation day (UTC)
    - textbox "对账日期": 2026-10-24
    - text: Run
    - combobox "对账运行":
      - option "选择运行" [disabled]
      - option "2026-10-24 · 7b461e3a-ddfa-4299-8c70-81445e99ea1b" [selected]
    - text: Source scope
    - textbox "对账来源范围": Expected ↔ Actual / Shadow
    - text: Last run / Result
    - paragraph: 2026-10-24 02:22:56.980 UTC differences
    - link "请求重新对账":
      - /url: "#p22-rerun"
  - region "对账摘要":
    - heading "Matched" [level=2]
    - strong: 未提供
    - paragraph: 来源未提供匹配总量或比例
    - heading "待调查" [level=2]
    - strong: "1"
    - paragraph: 已确认调查 0 · 当前返回记录
    - heading "已解决" [level=2]
    - strong: "0"
    - paragraph: 当前返回记录 · 不代表本期总量
    - heading "缺失数据" [level=2]
    - strong: 未提供
    - paragraph: 来源未提供缺失报告数量
  - region "账本差异":
    - heading "对账差异 / BreakGrid" [level=2]
    - navigation "差异分类":
      - button "全部 1" [pressed]
      - button "待调查 1"
      - button "已确认调查 0"
      - button "已解决 0"
    - text: 差异类型
    - combobox "差异类型":
      - option "全部已加载类型" [selected]
      - option "LedgerBalanceMismatch"
    - text: 搜索 Order / Fill / 差异
    - textbox "搜索差异":
      - /placeholder: Order / Fill / Entity
    - region "差异表":
      - table "当前返回记录；原始精度值，无手工改账入口":
        - caption: 当前返回记录；原始精度值，无手工改账入口
        - rowgroup:
          - row "状态 类型 / 对象 Order / Fill 内部值 · Expected 外部值 · Actual 最近检测 (UTC)":
            - columnheader "状态"
            - columnheader "类型 / 对象"
            - columnheader "Order / Fill"
            - columnheader "内部值 · Expected"
            - columnheader "外部值 · Actual"
            - columnheader "最近检测 (UTC)"
        - rowgroup:
          - row "待调查 查看差异 sha256:cc31fd25074460187226d9070a608cc2ec1af680611c04cf1e476ba3a4d6484c order owned-paper-order-1 fill owned-fill-1 order owned-paper-order-1 fill owned-fill-1 \"799\" \"798\" 2026-10-24 02:22:56.980 UTC":
            - cell "待调查"
            - rowheader "查看差异 sha256:cc31fd25074460187226d9070a608cc2ec1af680611c04cf1e476ba3a4d6484c":
              - button "查看差异 sha256:cc31fd25074460187226d9070a608cc2ec1af680611c04cf1e476ba3a4d6484c" [pressed]: LedgerBalanceMismatch ledger/cash
            - cell "order owned-paper-order-1 fill owned-fill-1 order owned-paper-order-1 fill owned-fill-1":
              - paragraph: order owned-paper-order-1
              - paragraph: fill owned-fill-1
              - paragraph: order owned-paper-order-1
              - paragraph: fill owned-fill-1
            - cell "\"799\"":
              - code: "\"799\""
            - cell "\"798\"":
              - code: "\"798\""
            - cell "2026-10-24 02:22:56.980 UTC":
              - time: 2026-10-24 02:22:56.980 UTC
    - text: 1 / 1 当前返回项 · 报告差异 1 账本及来源回报不可在客户端修改
    - link "查看 Orders":
      - /url: /orders
    - link "查看 Performance / 证据":
      - /url: "#p22-related"
    - button "导出差异清单" [disabled]
  - region "差异详情":
    - heading "差异详情" [level=2]
    - text: 待调查 · 严重度未提供
    - term: Object
    - definition: ledger/cash
    - term: Asset / Venue
    - definition: 来源未提供
    - term: Account
    - definition: 44444444-4444-4444-8444-444444444444
    - term: Detected
    - definition:
      - time: 2026-10-24 02:22:56.980 UTC
    - term: Break / Version
    - definition: sha256:cc31fd25074460187226d9070a608cc2ec1af680611c04cf1e476ba3a4d6484c / 0
    - region "值对比":
      - heading "值对比" [level=3]
      - heading "Expected · owned-synthetic-shadow" [level=4]
      - text: "\"799\""
      - heading "Actual · owned-synthetic-observed" [level=4]
      - text: "\"798\""
      - paragraph: ⓘ 原因 LedgerBalanceMismatch · 差值 / 容差：来源未提供
    - heading "关联对象" [level=3]
    - list:
      - listitem:
        - strong: order
        - code: owned-paper-order-1
        - text: owned-synthetic-shadow · source_record
      - listitem:
        - strong: fill
        - code: owned-fill-1
        - text: owned-synthetic-shadow · source_record
      - listitem:
        - strong: order
        - code: owned-paper-order-1
        - text: owned-synthetic-observed · source_record
      - listitem:
        - strong: fill
        - code: owned-fill-1
        - text: owned-synthetic-observed · source_record
      - listitem:
        - strong: alert
        - code: sha256:cc31fd25074460187226d9070a608cc2ec1af680611c04cf1e476ba3a4d6484c
        - text: quantos-x05-exceptions · x05_exception
    - heading "来源回报摘录" [level=3]
    - paragraph: 独立脱敏回报正文未提供；仅展示本差异的原始 Expected / Actual 值与来源引用。
    - paragraph: Closure 未提供关闭证明
    - link "查看差异证据":
      - /url: "#p22-related"
    - button "Audit 根未提供" [disabled]
    - heading "处置时间线" [level=3]
    - list:
      - listitem:
        - time: 2026-10-24 02:22:56.980 UTC
        - strong: 检测到差异
    - paragraph: 当前状态 open；调查人、处置时间和动作历史未提供。
    - heading "添加调查说明" [level=3]
    - paragraph: 仅记录调查说明，不修改账本事实。
    - textbox "调查说明" [disabled]:
      - /placeholder: 调查说明暂不可保存
    - button "保存说明暂不可用" [disabled]
    - paragraph:
      - text: Correlation ID
      - code: 19cc0ee6-a43e-423b-be01-8a04d0860138
  - region "只读资金账本":
    - heading "Funds Ledger / 只读资金账本" [level=2]
    - paragraph: 原始精度金额 · 不在浏览器计算余额或修改记录
    - text: 账本侧
    - combobox "账本侧":
      - option "Expected + Actual" [selected]
      - option "Expected"
      - option "Actual"
    - region "账本表":
      - table "当前运行 7b461e3a-ddfa-4299-8c70-81445e99ea1b · 账本条目 4":
        - caption: 当前运行 7b461e3a-ddfa-4299-8c70-81445e99ea1b · 账本条目 4
        - rowgroup:
          - row "Side / Kind Currency / AsOf Source / Version 原始金额 Entry / Source hash":
            - columnheader "Side / Kind"
            - columnheader "Currency / AsOf"
            - columnheader "Source / Version"
            - columnheader "原始金额"
            - columnheader "Entry / Source hash"
        - rowgroup:
          - 'row "actual / snapshot USD 2026-10-24 02:22:56.980 UTC owned-synthetic-observed v1 cash: 9007199254740993.123456789012345678 exposureGross: 220 realizedPnl: -1 unrealizedPnl: 20 sha256:438f998ee12c026d4463b7c0d9ed595d4ecbd25d61200cb80421004f7ebfbbd7 sha256:4a23b97b8029291135d52672bdba81a3dcc7c65e74604104804cf3e88064cb7e"':
            - rowheader "actual / snapshot"
            - cell "USD 2026-10-24 02:22:56.980 UTC":
              - text: USD
              - paragraph: 2026-10-24 02:22:56.980 UTC
            - cell "owned-synthetic-observed v1":
              - text: owned-synthetic-observed
              - paragraph: v1
            - 'cell "cash: 9007199254740993.123456789012345678 exposureGross: 220 realizedPnl: -1 unrealizedPnl: 20"':
              - paragraph:
                - text: "cash:"
                - strong: "9007199254740993.123456789012345678"
              - paragraph:
                - text: "exposureGross:"
                - strong: "220"
              - paragraph:
                - text: "realizedPnl:"
                - strong: "-1"
              - paragraph:
                - text: "unrealizedPnl:"
                - strong: "20"
            - cell "sha256:438f998ee12c026d4463b7c0d9ed595d4ecbd25d61200cb80421004f7ebfbbd7 sha256:4a23b97b8029291135d52672bdba81a3dcc7c65e74604104804cf3e88064cb7e":
              - code: sha256:438f998ee12c026d4463b7c0d9ed595d4ecbd25d61200cb80421004f7ebfbbd7
              - paragraph: sha256:4a23b97b8029291135d52672bdba81a3dcc7c65e74604104804cf3e88064cb7e
          - 'row "expected / snapshot USD 2026-10-24 02:22:56.980 UTC owned-synthetic-shadow v1 cash: 9007199254740993.123456789012345678 exposureGross: 220 realizedPnl: -1 unrealizedPnl: 20 sha256:4c7097cd0782f04cd4ab52b5d8721d7722a3e0b2880203174c25ec26577670e5 sha256:f1d40e1173e6cbdd215bf2b60e8227ba894cbbb626a8a58175ce724eed249ee7"':
            - rowheader "expected / snapshot"
            - cell "USD 2026-10-24 02:22:56.980 UTC":
              - text: USD
              - paragraph: 2026-10-24 02:22:56.980 UTC
            - cell "owned-synthetic-shadow v1":
              - text: owned-synthetic-shadow
              - paragraph: v1
            - 'cell "cash: 9007199254740993.123456789012345678 exposureGross: 220 realizedPnl: -1 unrealizedPnl: 20"':
              - paragraph:
                - text: "cash:"
                - strong: "9007199254740993.123456789012345678"
              - paragraph:
                - text: "exposureGross:"
                - strong: "220"
              - paragraph:
                - text: "realizedPnl:"
                - strong: "-1"
              - paragraph:
                - text: "unrealizedPnl:"
                - strong: "20"
            - cell "sha256:4c7097cd0782f04cd4ab52b5d8721d7722a3e0b2880203174c25ec26577670e5 sha256:f1d40e1173e6cbdd215bf2b60e8227ba894cbbb626a8a58175ce724eed249ee7":
              - code: sha256:4c7097cd0782f04cd4ab52b5d8721d7722a3e0b2880203174c25ec26577670e5
              - paragraph: sha256:f1d40e1173e6cbdd215bf2b60e8227ba894cbbb626a8a58175ce724eed249ee7
          - 'row "expected / fill USD 2026-10-24 02:22:56.980 UTC owned-synthetic-shadow v1 fee: 1 price: 100 quantity: 2 cash: 9007199254740993.123456789012345678 sha256:64380ecf8c46e7cbae9ff27b2e861a74a890048cd6916606f59620cf9eec76a1 sha256:f1d40e1173e6cbdd215bf2b60e8227ba894cbbb626a8a58175ce724eed249ee7"':
            - rowheader "expected / fill"
            - cell "USD 2026-10-24 02:22:56.980 UTC":
              - text: USD
              - paragraph: 2026-10-24 02:22:56.980 UTC
            - cell "owned-synthetic-shadow v1":
              - text: owned-synthetic-shadow
              - paragraph: v1
            - 'cell "fee: 1 price: 100 quantity: 2 cash: 9007199254740993.123456789012345678"':
              - paragraph:
                - text: "fee:"
                - strong: "1"
              - paragraph:
                - text: "price:"
                - strong: "100"
              - paragraph:
                - text: "quantity:"
                - strong: "2"
              - paragraph:
                - text: "cash:"
                - strong: "9007199254740993.123456789012345678"
            - cell "sha256:64380ecf8c46e7cbae9ff27b2e861a74a890048cd6916606f59620cf9eec76a1 sha256:f1d40e1173e6cbdd215bf2b60e8227ba894cbbb626a8a58175ce724eed249ee7":
              - code: sha256:64380ecf8c46e7cbae9ff27b2e861a74a890048cd6916606f59620cf9eec76a1
              - paragraph: sha256:f1d40e1173e6cbdd215bf2b60e8227ba894cbbb626a8a58175ce724eed249ee7
          - 'row "actual / fill USD 2026-10-24 02:22:56.980 UTC owned-synthetic-observed v1 fee: 1 price: 100 quantity: 2 cash: 9007199254740993.123456789012345678 sha256:d34c77d8233fb68bf366b09a204c60f603ced6b452099458e814ee1f706fd214 sha256:4a23b97b8029291135d52672bdba81a3dcc7c65e74604104804cf3e88064cb7e"':
            - rowheader "actual / fill"
            - cell "USD 2026-10-24 02:22:56.980 UTC":
              - text: USD
              - paragraph: 2026-10-24 02:22:56.980 UTC
            - cell "owned-synthetic-observed v1":
              - text: owned-synthetic-observed
              - paragraph: v1
            - 'cell "fee: 1 price: 100 quantity: 2 cash: 9007199254740993.123456789012345678"':
              - paragraph:
                - text: "fee:"
                - strong: "1"
              - paragraph:
                - text: "price:"
                - strong: "100"
              - paragraph:
                - text: "quantity:"
                - strong: "2"
              - paragraph:
                - text: "cash:"
                - strong: "9007199254740993.123456789012345678"
            - cell "sha256:d34c77d8233fb68bf366b09a204c60f603ced6b452099458e814ee1f706fd214 sha256:4a23b97b8029291135d52672bdba81a3dcc7c65e74604104804cf3e88064cb7e":
              - code: sha256:d34c77d8233fb68bf366b09a204c60f603ced6b452099458e814ee1f706fd214
              - paragraph: sha256:4a23b97b8029291135d52672bdba81a3dcc7c65e74604104804cf3e88064cb7e
  - region "对账运行事实":
    - heading "运行事实" [level=2]
    - button "续传并核对运行"
    - button "重读完整差异与账本"
    - paragraph: 暂定结果，不能视为最终对账完成 · 当前事实已核对
    - term: Run
    - definition: 7b461e3a-ddfa-4299-8c70-81445e99ea1b
    - term: Day
    - definition: 2026-10-24
    - term: Account
    - definition: 44444444-4444-4444-8444-444444444444
    - term: Mode
    - definition: shadow
    - term: Currency
    - definition: USD
    - term: Version
    - definition: "0"
    - term: Report
    - definition: sha256:38164024b89da0096387d81d599bd90bf686d259af1b0a1ed1b3e56d56d2624d
    - term: Input
    - definition: sha256:6b9a4c1661cfc28cb04e4f4ec7912eefa131d788aa7ea8644e10494a66451c60
    - term: AsOf
    - definition: 2026-10-24T02:22:56.980727Z
    - term: Expires
    - definition: 2026-10-24T02:27:56.980727Z
    - term: Correlation
    - definition: 19cc0ee6-a43e-423b-be01-8a04d0860138
    - term: Audit
    - definition: 初始观察未提供审计根
    - term: BreakCount
    - definition: "1"
    - term: Sequence
    - definition: "1"
  - region "账本来源栏":
    - text: Internal / Expected
    - paragraph: owned-synthetic-shadow
    - text: v1 Observed / Actual
    - paragraph: owned-synthetic-observed
    - text: v1 Coverage day
    - paragraph: 2026-10-24 UTC
    - text: Last checkpoint
    - paragraph: 2026-10-24 02:22:56.980 UTC
    - link "查看证据链":
      - /url: "#p22-related"
    - text: 初始观察无审计根
  - region "关联证据":
    - heading "Order / Fill / Performance / Alert / Audit" [level=2]
    - button "核对关联 Performance Alert Audit"
    - list:
      - listitem:
        - strong: order
        - code: owned-paper-order-1
        - text: owned-synthetic-shadow · source_record
      - listitem:
        - strong: fill
        - code: owned-fill-1
        - text: owned-synthetic-shadow · source_record
      - listitem:
        - strong: order
        - code: owned-paper-order-1
        - text: owned-synthetic-observed · source_record
      - listitem:
        - strong: fill
        - code: owned-fill-1
        - text: owned-synthetic-observed · source_record
  - region "请求审计重跑":
    - heading "请求重新对账" [level=2]
    - paragraph: 使用当前 Run 版本，只请求服务端重新评估。202 不代表对账完成，重跑不自动消除既有差异。
    - text: 重跑理由
    - textbox "重跑理由"
    - button "请求重跑" [disabled]
  - group: Runbook · 对账调查与受控重跑
- contentinfo "连接状态": 访问：已授权 · SHADOW 实时：当前事实已核对 账本：只读来源 Worker 健康：未提供 最后同步 2026-10-24 02:23:00.240 UTC
- alert
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import {writeFile} from 'node:fs/promises';
  4  | import {installReferenceHooks,authorized,networkRows,fault,control} from './fixtures/ui-p22-reference';
  5  | installReferenceHooks();
  6  | const facts=(p:Page)=>p.getByRole('region',{name:'对账运行事实',exact:true}),writes=()=>networkRows().filter(r=>r.method==='POST'&&!r.control);
  7  | async function open(p:Page){const c=await control('/v1/context'),a=c.body.accountId;const q=await control('/v1/reconciliation/runs?accountId='+a);const rows=q.body.items as {runId:string;result:string}[];const id=rows.find(r=>r.result==='differences')!.runId;await p.goto('/reconciliation/'+id);await authorized(p);await expect(facts(p)).toContainText(id);return id;}
  8  | async function rerun(p:Page){await p.getByLabel('重跑理由',{exact:true}).fill('investigate immutable source books');await p.getByRole('button',{name:'请求重跑',exact:true}).click();const d=p.getByRole('dialog');await d.getByLabel('输入“RERUN RECONCILIATION”以确认').fill('RERUN RECONCILIATION');await d.getByRole('button',{name:'确认重跑请求',exact:true}).click();}
  9  | test('P22 actual X05 immutable ledger rerun stream and Audit chain',async({page})=>{const original=await open(page);await expect(page.getByRole('region',{name:'只读资金账本',exact:true})).toContainText('actual');await expect(page.getByRole('region',{name:'账本差异',exact:true})).toContainText('待调查');await page.getByRole('button',{name:'核对关联 Performance Alert Audit',exact:true}).click();await expect(page.getByTestId('recon-alerts')).toBeVisible();await rerun(page);await expect(page.getByRole('region',{name:'重跑受理回执',exact:true})).toBeVisible();await expect(facts(page).locator('dd').first()).not.toHaveText(original);await expect(facts(page)).toContainText('暂定结果');await page.getByRole('button',{name:'核对关联 Performance Alert Audit',exact:true}).click();await expect(page.getByTestId('recon-chain')).toContainText('true');expect(writes()).toHaveLength(1);expect(writes()[0].path).toBe('/v1/reconciliation/runs/'+original+'/reruns');await page.getByRole('button',{name:'续传并核对运行',exact:true}).click();await expect.poll(()=>networkRows().some(r=>r.path.endsWith('/stream')&&r.path.includes('/reconciliation/')&&Number(r.query.afterSequence)>0)).toBe(true);});
  10 | test('P22 lost committed response recovers original key body and version exactly once',async({page})=>{await open(page);fault({drop:true});await rerun(page);await expect(page.getByRole('region',{name:'未知结果',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'请求重跑',exact:true})).toBeDisabled();expect(writes()).toHaveLength(1);await page.getByRole('button',{name:'恢复原请求',exact:true}).click();await expect(page.getByRole('region',{name:'未知结果',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'重跑受理回执',exact:true})).toBeVisible();expect(writes()).toHaveLength(2);expect(writes()[0].keyHash).toBe(writes()[1].keyHash);expect(writes()[0].bodyHash).toBe(writes()[1].bodyHash);expect(writes()[0].version).toBe(writes()[1].version);});
  11 | test('P22 journal gap stops new reruns then explicit full read recovers',async({page})=>{await open(page);fault({gap:true});await page.getByRole('button',{name:'续传并核对运行',exact:true}).click();await expect(page.locator('main [role=alert]')).toBeVisible();await expect(facts(page)).toContainText('核对陈旧');await expect(page.getByRole('button',{name:'请求重跑',exact:true})).toBeDisabled();fault({});await page.getByRole('button',{name:'重读完整差异与账本',exact:true}).click();await expect(facts(page)).toContainText('当前事实已核对');expect(writes()).toHaveLength(0);});
  12 | test('P22 scope mismatch never publishes foreign ledger or run',async({page})=>{fault({foreign:true});await page.goto('/reconciliation');await authorized(page);await expect(page.locator('main [role=alert]')).toBeVisible();await expect(facts(page)).toHaveCount(0);expect(writes()).toHaveLength(0);});
  13 | test('P22 expired source read-only never enables rerun',async({page})=>{fault({expired:true});await open(page);await expect(facts(page)).toContainText('核对陈旧');await page.getByLabel('重跑理由',{exact:true}).fill('expired');await expect(page.getByRole('button',{name:'请求重跑',exact:true})).toBeDisabled();expect(writes()).toHaveLength(0);});
  14 | test('P22 409 does not invent a run or automatically retry',async({page})=>{await open(page);fault({conflict:true});await rerun(page);await expect(page.locator('main [role=alert]')).toBeVisible();await expect(page.getByRole('region',{name:'重跑受理回执',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'未知结果',exact:true})).toHaveCount(0);expect(writes()).toHaveLength(1);});
  15 | test('P22 empty loading and 429 sanitized explicit retry',async({page})=>{fault({empty:true,slow:true});await page.goto('/reconciliation');await authorized(page);await expect(page.getByText('正在读取对账事实…',{exact:true})).toBeVisible();await expect(page.getByText('当前授权及筛选的运行页为空。',{exact:true})).toBeVisible();fault({rateLimit:true});await page.getByRole('button',{name:'刷新运行列表',exact:true}).click();await expect(page.locator('main [role=alert]')).toContainText('冷却');await expect(page.getByRole('button',{name:'刷新运行列表',exact:true})).toBeDisabled();await expect(page.getByText('private SQL',{exact:false})).toHaveCount(0);expect(writes()).toHaveLength(0);});
  16 | test('P22 viewer injected scope unknown route refused',async({page})=>{fault({readonly:true});await page.goto('/reconciliation');await expect(page.locator('[data-route-access="denied"]')).toBeVisible();expect(networkRows().some(r=>r.path==='/v1/reconciliation/runs')).toBe(false);fault({});const count=networkRows().length;await page.goto('/reconciliation?accountId=evil');await expect(page.getByRole('heading',{name:'Reconciliation 引用无效',exact:true})).toBeVisible();expect(networkRows()).toHaveLength(count);expect((await page.goto('/reconciliation/nope'))?.status()).toBe(404);});
  17 | test('P22 offline and actual logout clear facts and recovery',async({page,context})=>{await open(page);await context.setOffline(true);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await expect(facts(page)).toHaveCount(0);await context.setOffline(false);await page.reload();await authorized(page);await expect(facts(page)).toBeVisible();expect((await control('/v1/auth/logout',undefined,undefined,{method:'POST'})).status).toBe(204);await expect(page.locator('[data-route-access="denied"]')).toBeVisible();await expect(facts(page)).toHaveCount(0);expect(writes()).toHaveLength(0);});
  18 | test('P22 dark light responsive ledger keyboard and axe',async({page},info)=>{await open(page);const scans=[];for(const theme of ['dark','light']as const){await page.emulateMedia({colorScheme:theme});await expect(page.locator('[data-quantos-theme]')).toHaveAttribute('data-quantos-theme',theme);await expect(page.locator('.p22-frame')).toBeVisible();for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const scan=await new AxeBuilder({page}).analyze();scans.push({theme,width,violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath('p22-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));expect(scan.violations).toEqual([]);await page.screenshot({path:info.outputPath(`reconciliation-${theme}-${width}.png`),fullPage:false});await page.getByRole('region',{name:'只读资金账本',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`ledger-${theme}-${width}.png`),fullPage:false});await page.getByRole('heading',{name:'Reconciliation',exact:true}).scrollIntoViewIfNeeded();}}for(const name of ['差异表','账本表']){const table=page.getByRole('region',{name,exact:true});await table.scrollIntoViewIfNeeded();await table.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>table.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);}expect(writes()).toHaveLength(0);});
  19 | test('P22 explicit synthetic status rows filter and select without rewriting financial facts',async({page},info)=>{fault({stateRows:true});const run=await open(page);const grid=page.getByRole('region',{name:'账本差异',exact:true}),detail=page.getByRole('region',{name:'差异详情',exact:true});await expect(page.getByRole('region',{name:'对账摘要',exact:true})).toContainText('Matched');await expect(page.getByRole('region',{name:'对账摘要',exact:true})).toContainText('未提供');await grid.getByRole('button',{name:'已解决 1',exact:true}).click();await expect(grid.locator('tbody tr')).toHaveCount(1);await grid.getByRole('button',{name:/查看差异/}).click();await expect(detail).toContainText('FeeMismatch');await expect(detail.getByRole('region',{name:'值对比',exact:true})).toContainText('9.19');await expect(detail).toContainText('严重度未提供');const url=new URL(page.url());expect(url.pathname).toBe('/reconciliation/'+run);expect(url.searchParams.get('breakId')).toMatch(/^sha256:[a-f0-9]{64}$/);await page.screenshot({path:info.outputPath('closed-synthetic.png'),fullPage:true});await grid.getByRole('button',{name:'全部 3',exact:true}).click();await page.getByLabel('搜索差异',{exact:true}).fill('ETH quantity');await expect(grid.locator('tbody tr')).toHaveCount(1);await grid.getByRole('button',{name:/查看差异/}).click();await expect(detail).toContainText('已确认调查');await expect(detail).toContainText('调查人、处置时间和动作历史未提供');await page.getByLabel('搜索差异',{exact:true}).fill('not-found');await expect(grid).toContainText('当前筛选没有差异记录');await expect(page.getByRole('region',{name:'对账摘要',exact:true})).toContainText('当前返回记录');expect(writes()).toHaveLength(0);});
> 20 | test('P22 ledger raw precision side filters disabled unsupported writes and Escape confirmation',async({page})=>{fault({largeDecimal:true});await open(page);const ledger=page.getByRole('region',{name:'只读资金账本',exact:true});await expect(ledger).toContainText('9007199254740993.123456789012345678');await page.getByLabel('账本侧',{exact:true}).selectOption('actual');await expect(ledger.locator('tbody tr')).toHaveCount(2);await expect(ledger.locator('tbody')).not.toContainText('expected');await expect(page.getByLabel('调查说明',{exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'保存说明暂不可用',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'导出差异清单',exact:true})).toBeDisabled();await page.getByRole('link',{name:'打开 Runbook',exact:true}).click();await expect(page.getByText('核对账户、日期、来源 hash、差异原值及相关 Order / Fill。',{exact:true})).toBeVisible();await page.getByLabel('重跑理由',{exact:true}).fill('review only');await page.getByRole('button',{name:'请求重跑',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);expect(writes()).toHaveLength(0);});
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   ^ Error: expect(locator).toBeVisible() failed
  21 | test('P22 exact break deep link selects current exception and foreign break never publishes facts',async({page})=>{const run=await open(page),q=new URL(page.url()).searchParams.get('breakId');expect(q).toMatch(/^sha256:/);await page.reload();await authorized(page);await expect(page.getByRole('region',{name:'差异详情',exact:true})).toContainText(q!);await page.goto('/reconciliation/'+run+'?breakId='+encodeURIComponent('sha256:'+'f'.repeat(64)));await authorized(page);await expect(page.locator('main [role=alert]')).toContainText('不存在');await expect(facts(page)).toHaveCount(0);expect(writes()).toHaveLength(0);});
  22 | 
```