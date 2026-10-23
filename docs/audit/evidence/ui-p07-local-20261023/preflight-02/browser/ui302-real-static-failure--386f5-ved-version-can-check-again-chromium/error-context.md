# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui302.spec.ts >> real static failure blocks backtest; repaired saved version can check again
- Location: tests/e2e/ui302.spec.ts:9:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/通过 · v/)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/通过 · v/)

```

```yaml
- link "跳至正文":
  - /url: "#_r_0_"
- banner:
  - button "折叠侧栏" [expanded]: SUMALPHA
  - text: ▣ Workspace 33333333 Account 44444444 PAPER
  - textbox "全局搜索" [disabled]:
    - /placeholder: 搜索  ⌘K
  - button "通知" [disabled]: ♧
  - link "帮助":
    - /url: "#strategy-help"
    - text: "?"
  - link "打开个人设置":
    - /url: /settings/profile
    - text: "11"
- complementary "主导航":
  - navigation:
    - link "Command":
      - /url: /command
    - link "Research":
      - /url: /research
    - link "Strategy":
      - /url: /strategies
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
  - navigation "Strategy 导航":
    - link "策略目录":
      - /url: /strategies
    - text: / Strategy Lab
  - heading "Strategy Lab" [level=1]
  - strong: Owned momentum
  - text: 草稿 v3 01a167d5-7b49-7a83-84b3-30c447b023c0
  - button "切换主题": ◐
  - button "运行静态检查"
  - button "创建回测" [disabled]
  - link "查看 Release":
    - /url: /releases
  - strong: 策略草稿不能直接交易。
  - text: 请完成验证、回测和审批。
  - alert: 服务端拒绝当前内容或检查，请修正草稿并保存后重试。 关联 ID：01a167d5-8675-7000-8fcf-810dda63035a
  - complementary "策略目录与文件":
    - region "策略目录":
      - heading "策略目录" [level=2]
      - text: 本页 2 搜索本页策略
      - textbox "搜索本页策略"
      - link "新建策略说明":
        - /url: /strategies/new
        - text: ＋
      - group "目录视图":
        - button "卡片视图" [pressed]: ▦
        - button "表格视图": ☷
      - article:
        - link "打开 Lab：Owned momentum":
          - /url: /strategies/01a167d5-7b49-7a83-84b3-30c447b023c0/lab
          - strong: Owned momentum
          - text: 01a167d5…b023c0 更新时间
          - time: 2026-10-23 08:16 UTC
      - article:
        - link "打开 Lab：Owned momentum alternative":
          - /url: /strategies/01a167d5-7b49-7a83-84b3-31199518afdc/lab
          - strong: Owned momentum alternative
          - text: 01a167d5…18afdc 更新时间
          - time: 2026-10-23 08:16 UTC
      - paragraph: 搜索只作用于已读取的当前页。版本与状态以打开的草稿为准。
    - region "文件与版本":
      - heading "文件与版本" [level=2]
      - list:
        - listitem:
          - button "strategy.rule" [pressed]
      - heading "当前版本" [level=3]
      - text: v3 current
      - time: 08:16:48 UTC
      - paragraph: 历史版本未由 C05 返回；不推算版本列表。
      - button "比较历史版本" [disabled]
  - tablist "Lab 编辑视图":
    - tab "strategy.rule" [selected]
    - tab "参数"
    - tab "研究引用"
    - tab "全部文件 JSON"
  - text: 受控编辑器
  - status: 已保存 · objectVersion：3
  - text: 草稿编辑
  - tabpanel "strategy.rule":
    - text: 文件内容
    - textbox "文件内容"
  - text: strategy.rule UTF-8 · 版本化保存
  - heading "参数" [level=2]
  - button "编辑参数"
  - term: entry_threshold_bps
  - definition: "20"
  - term: exit_threshold_bps
  - definition: "-10"
  - term: lookback
  - definition: "6"
  - term: max_position_notional
  - definition: "1000"
  - paragraph: 保留服务端参数类型，最终校验由服务端执行。
  - heading "固定输入" [level=2]
  - term: DataSnapshot
  - definition:
    - link "01a167d5…dcf5d7":
      - /url: /data-snapshots/01a167d5-7b3d-7621-a7a4-3bdcf6dcf5d7
  - term: ResearchArtifact
  - definition: 1 项引用
  - term: Environment hash
  - definition: 报告内核对
  - button "查看研究证据"
  - complementary "校验与实验":
    - region "Validation 面板":
      - heading "Validation" [level=2]
      - text: 当前草稿
      - list:
        - listitem:
          - strong: JSON 与请求大小
          - text: 本地校验有效
        - listitem:
          - strong: 静态检查 / Look-ahead
          - text: 未通过，阻断回测
        - listitem:
          - strong: 数据与许可证
          - text: 用途校验结果未提供
        - listitem:
          - strong: 依赖与隔离
          - text: 检查结果未提供
      - paragraph: 草稿保存不代表检查通过，也不能提交发布候选。
      - button "保存草稿" [disabled]
    - region "实验队列":
      - heading "实验队列" [level=2]
      - text: 0 项
      - paragraph: 仅本会话已接受的任务；C05 没有全局队列查询。最多 25 项。
      - paragraph: 暂无已接受的回测任务
  - region "Backtest Queue":
    - heading "Backtest Queue" [level=2]
    - text: 固定输入 · 可复现报告
    - paragraph: 已接受任务：0。202 仅代表受理，最终状态、指标和泄漏检查以服务端报告为准。
    - text: 已有任务 ID
    - textbox "已有任务 ID"
    - button "读取已有报告"
    - paragraph: 回测结果不等于可部署策略。泄漏失败、报告缺失或版本变化阻断 Release。
  - group: 保存与恢复说明
- contentinfo "连接状态": "Connection: Authorized Draft autosave: 已保存 当前授权范围 · PAPER · 非交易指令"
- alert
```

# Test source

```ts
  1  | import {test,expect} from "@playwright/test";
  2  | import AxeBuilder from "@axe-core/playwright";
  3  | import {openLab,authorized,fault,networkRows,installReferenceHooks} from "./fixtures/ui301-reference";
  4  | import {writeFile} from "node:fs/promises";
  5  | installReferenceHooks();
  6  | test("real C05 static check, pinned backtest, report SSE and deep link",async({page},info)=>{
  7  |  await openLab(page,false);await expect(page.getByRole("button",{name:"创建回测",exact:true})).toBeDisabled();await page.getByRole("button",{name:"运行静态检查",exact:true}).click();await expect(page.getByText(/通过 · v/)).toBeVisible();await page.getByRole("button",{name:"创建回测",exact:true}).click();const link=page.getByRole("link",{name:/回测报告 v/}).first();await expect(link).toBeVisible();const href=(await link.getAttribute('href'))!;await link.click();await authorized(page);await expect(page.getByRole('heading',{name:'Backtest Report'})).toBeVisible();await expect(page.getByText(/事件流：complete/)).toBeVisible();for(const key of ['clock','fee_bps','slippage_bps','environment_hash','reportHash'])await expect(page.getByText(key,{exact:true})).toBeVisible();await expect(page.getByText('回测证据完整；创建 Release 前仍须重读草稿与证据')).toBeVisible();await expect(page.getByRole('button',{name:'创建不可变 Release',exact:true})).toBeVisible();expect(networkRows().some(r=>r.method==='POST'&&r.path==='/v1/releases')).toBe(false);await writeFile(info.outputPath("report.json"),(await page.getByTestId("raw-backtest-report").textContent())!);const scans=[];for(const width of [1440,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const axe=await new AxeBuilder({page}).analyze();scans.push({width,violations:axe.violations,incomplete:axe.incomplete});expect(axe.violations).toEqual([]);await page.screenshot({path:info.outputPath(`report-${width}.png`),fullPage:true});}await writeFile(info.outputPath('ui302-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));await page.reload();await authorized(page);await expect(page.getByText(/事件流：complete/)).toBeVisible();expect(page.url()).toContain(href);expect(networkRows().filter(r=>r.method==='POST'&&r.path==='/v1/backtests')).toHaveLength(1);
  8  | });
  9  | test("real static failure blocks backtest; repaired saved version can check again",async({page})=>{
> 10 |  await openLab(page,false);const editor=page.getByLabel('文件内容',{exact:true}),original=await editor.inputValue();await editor.fill(original+'\nBAD_UNTRUSTED');await expect(page.getByText(/已保存 · objectVersion/)).toBeVisible();await page.getByRole('button',{name:'运行静态检查',exact:true}).click();await expect(page.getByText('未通过，阻断回测')).toBeVisible();await expect(page.getByRole('button',{name:'创建回测',exact:true})).toBeDisabled();expect(networkRows().some(r=>r.status===422&&r.path.endsWith('static-checks'))).toBe(true);await editor.fill(original);await expect(page.getByText(/已保存 · objectVersion/)).toBeVisible();await page.getByRole('button',{name:'运行静态检查',exact:true}).click();await expect(page.getByText(/通过 · v/)).toBeVisible();expect(networkRows().filter(r=>r.path==='/v1/backtests')).toHaveLength(0);
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           ^ Error: expect(locator).toBeVisible() failed
  11 | });
  12 | test("lost committed backtest explicitly replays same key, no duplicate run",async({page})=>{
  13 |  await openLab(page,false);await page.getByRole('button',{name:'运行静态检查',exact:true}).click();await expect(page.getByText(/通过 · v/)).toBeVisible();fault({drop:true});await page.getByRole('button',{name:'创建回测',exact:true}).click();await expect(page.getByRole('button',{name:'重试原回测请求'})).toBeVisible();await expect(page.getByLabel('文件内容',{exact:true})).toBeDisabled();await page.getByRole('button',{name:'重试原回测请求'}).click();await expect(page.getByRole('link',{name:/回测报告 v/})).toHaveCount(1);const writes=networkRows().filter(r=>r.method==='POST'&&r.path==='/v1/backtests');expect(writes).toHaveLength(2);expect(writes[0].keyHash).toBe(writes[1].keyHash);expect(writes[0].bodyHash).toBe(writes[1].bodyHash);expect(writes[0].responseHash).toBe(writes[1].responseHash);
  14 | });
  15 | test("approver reads Lab but cannot check or create backtest",async({page})=>{fault({readonly:true});await openLab(page,false);await expect(page.getByRole('button',{name:'运行静态检查',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'创建回测',exact:true})).toBeDisabled();expect(networkRows().some(r=>r.method==='POST')).toBe(false);});
  16 | test("missing report and malformed deep links disclose no invented facts or writes",async({page})=>{await page.goto('/backtests/aaaaaaaa-1111-4111-8111-111111111111');await authorized(page);await expect(page.locator('main').getByRole('alert')).toContainText('报告不可用');await expect(page.getByRole('heading',{name:'Metrics',exact:true})).toHaveCount(0);expect(networkRows().some(r=>r.method!=='GET')).toBe(false);const response=await page.goto('/backtests/not-a-uuid');expect(response?.status()).toBe(404);});
  17 | 
```