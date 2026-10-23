# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend-g3.spec.ts >> G3 fixture 01 actual IPC Artifact to Lab Backtest Release approval target and Audit
- Location: tests/e2e/frontend-g3.spec.ts:12:39

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator: getByRole('button', { name: '创建不可变 Release', exact: true })
Expected: enabled
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeEnabled" with timeout 5000ms
  - waiting for getByRole('button', { name: '创建不可变 Release', exact: true })

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
    - /url: "#p07-help"
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
  - button "切换主题": ◐
  - navigation "回测导航":
    - link "Strategy":
      - /url: /strategies
    - text: / / Backtest
  - heading "Backtest Report" [level=1]
  - text: 读取中
  - button "刷新报告与事件流"
  - button "比较回测" [disabled]
  - status: 事件流：idle · 已确认序号 0
  - paragraph:
    - strong: ⓘ 回测结果不等于可部署策略。
    - text: 固定输入、回测与审批须逐项核对。
  - alert: 报告不可用（502）。请核对任务引用、授权或稍后显式刷新。
  - heading "报告尚不可用" [level=2]
  - paragraph: 等待完整固定输入与可验证的报告。
  - complementary "Strategy Release":
    - heading "Strategy Release" [level=2]
    - paragraph: 尚无完整可验证的报告；创建不可变候选被阻断。
  - paragraph: 只读报告与不可变候选工作区。审批、目标选择和部署分别受控；比较、导出与回滚尚未接入。
- contentinfo "连接状态": ● 授权范围已核对 PAPER · 候选审阅 部署与交易未授权
- alert
```

# Test source

```ts
  1  | import {test,expect,type Page} from "@playwright/test";
  2  | import AxeBuilder from "@axe-core/playwright";
  3  | import {writeFile} from "node:fs/promises";
  4  | import {authorized,control,decide,advance,fault,networkRows,installReferenceHooks} from "./fixtures/frontend-g3-reference";
  5  | installReferenceHooks();
  6  | async function create(page:Page,index=1){
  7  |  await page.goto('/strategies');await authorized(page);await expect(page.locator('.p06-strategy-cards article')).toHaveCount(20);const link=page.getByRole('link',{name:`打开 Lab：G3 strategy ${String(index).padStart(2,'0')}`,exact:true}),lab=(await link.getAttribute('href'))!;await link.click();await authorized(page);await expect(page.getByRole('status').filter({hasText:'已保存 · objectVersion：'})).toBeVisible();const draft=(await control(lab.replace('/lab','/draft').replace('/strategies/','/v1/strategies/'))).body,refs=draft.artifactRefs as {artifact_id:string;content_hash:string}[];expect(refs).toHaveLength(1);
> 8  |  await page.goto(`/artifacts/${refs[0].artifact_id}`);await authorized(page);await expect(page.getByRole('region',{name:'Artifact 元数据',exact:true})).toContainText('strategy-lab-owned-ipc');await page.goto(lab);await authorized(page);await page.getByRole('button',{name:'运行静态检查',exact:true}).click();await expect(page.getByText(/通过 · v/)).toBeVisible();await page.getByRole('button',{name:'创建回测',exact:true}).click();await page.getByRole('link',{name:/回测报告 v/}).first().click();await authorized(page);await expect(page.getByRole('button',{name:'创建不可变 Release',exact:true})).toBeEnabled();const report=JSON.parse((await page.getByTestId('raw-backtest-report').textContent())!);expect(report.status).toBe('succeeded');expect(report.report.leak_check.violations).toBe(0);expect(report.report.candidate.source_commit).toBe(process.env.GITHUB_SHA);await page.getByRole('button',{name:'创建不可变 Release',exact:true}).click();await page.getByRole('link',{name:'查看 Release 详情',exact:true}).click();await authorized(page);await expect(page.getByTestId('raw-release')).toBeAttached();const release=JSON.parse((await page.getByTestId('raw-release').textContent())!);expect(release.evidenceRefs).toEqual(refs);expect(release.backtestReportHash).toBe(report.reportHash);expect(release.snapshotId).toBe(draft.dataSnapshotId);expect(release.sourceDigest).toBe(process.env.GITHUB_SHA);expect(release.approvalState).toBe('none');await expect(page.getByLabel('目标选择',{exact:true})).toBeDisabled();return {draft,report,release};
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              ^ Error: expect(locator).toBeEnabled() failed
  9  | }
  10 | async function submit(page:Page){await page.getByRole('button',{name:'提交审批申请',exact:true}).click();await expect(page.getByText(/服务端状态：pending/)).toBeVisible();await expect(page.getByLabel('目标选择',{exact:true})).toBeDisabled();return JSON.parse((await page.getByTestId('raw-release').textContent())!);}
  11 | async function refresh(page:Page,state:string){await page.getByRole('button',{name:'刷新 Release 与审批',exact:true}).click();await expect(page.getByText(new RegExp(`服务端状态：${state}`))).toBeVisible();}
  12 | for(let index=1;index<=20;index++)test(`G3 fixture ${String(index).padStart(2,'0')} actual IPC Artifact to Lab Backtest Release approval target and Audit`,async({page},info)=>{
  13 |  const {draft,report,release}=await create(page,index),pending=await submit(page);expect((await decide(pending.approvalRef))[0].status).toBe(200);await refresh(page,'approved');const approved=JSON.parse((await page.getByTestId('raw-release').textContent())!);expect(approved.contentHash).toBe(release.contentHash);expect(approved.parameters).toEqual(release.parameters);expect(approved.approvalTimeline.map((e:{action:string})=>e.action)).toEqual(['submitted','approve']);await page.getByLabel('目标选择',{exact:true}).selectOption(index%2?'paper':'shadow');await expect(page.getByText(`已选择目标：${index%2?'paper':'shadow'}`,{exact:true})).toBeVisible();await page.getByRole('link',{name:'审计因果链',exact:true}).first().click();await authorized(page);await expect(page.getByRole('heading',{name:'Audit Explorer',exact:true})).toBeVisible();await expect(page.getByText('当前授权范围内链完整',{exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'因果证据链',exact:true})).toContainText(release.releaseId);
  14 |  await writeFile(info.outputPath('g3-fixture.json'),JSON.stringify({index,sourceCommit:process.env.GITHUB_SHA,draft,report,pending,approved,auditPath:new URL(page.url()).pathname},null,2));expect(networkRows().some(r=>r.path==='/v1/commands'||r.path.includes('deployment'))).toBe(false);
  15 |  if(index===1){const scans=[];for(const width of [1672,390]){await page.setViewportSize({width,height:900});const a=await new AxeBuilder({page}).analyze();scans.push({width,violations:a.violations,incomplete:a.incomplete});expect(a.violations).toEqual([]);await page.screenshot({path:info.outputPath(`g3-audit-${width}.png`),fullPage:true});}await writeFile(info.outputPath('g3-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'}));}
  16 | });
  17 | test('G3 rejected decision and immutable evidence remain explicit and targets denied',async({page},info)=>{const {release}=await create(page),p=await submit(page);expect((await decide(p.approvalRef,'reject'))[0].status).toBe(200);await refresh(page,'rejected');await expect(page.getByLabel('目标选择',{exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'提交审批申请',exact:true})).toBeDisabled();const r=JSON.parse((await page.getByTestId('raw-release').textContent())!);expect(r.contentHash).toBe(release.contentHash);expect(r.approvalTimeline.at(-1).action).toBe('reject');await writeFile(info.outputPath('g3-rejected.json'),JSON.stringify(r));});
  18 | test('G3 trusted host expiry clears selected target after authoritative refresh',async({page},info)=>{await create(page);const p=await submit(page);expect((await decide(p.approvalRef))[0].status).toBe(200);await refresh(page,'approved');await page.getByLabel('目标选择',{exact:true}).selectOption('paper');await advance(301);await refresh(page,'expired');await expect(page.getByLabel('目标选择',{exact:true})).toBeDisabled();await expect(page.getByText('已选择目标：paper',{exact:true})).toHaveCount(0);await writeFile(info.outputPath('g3-expired.json'),(await page.getByTestId('raw-release').textContent())!);});
  19 | test('G3 twenty concurrent independent approval controls produce one decision only',async({page},info)=>{await create(page);const p=await submit(page),results=await decide(p.approvalRef,'approve',20);expect(results.filter(r=>r.status===200)).toHaveLength(1);expect(results.filter(r=>r.status===403||r.status===409)).toHaveLength(19);await refresh(page,'approved');const r=JSON.parse((await page.getByTestId('raw-release').textContent())!);expect(r.approvalTimeline.filter((e:{action:string})=>e.action==='approve')).toHaveLength(1);await writeFile(info.outputPath('g3-concurrency.json'),JSON.stringify({statuses:results.map(r=>r.status),release:r}));});
  20 | test('G3 readonly and offline recovery preserve facts without replaying business commands',async({page})=>{await create(page);const path=new URL(page.url()).pathname,count=networkRows().filter(r=>r.method==='POST').length;fault({readonly:true});await page.reload();await authorized(page);await expect(page.getByTestId('raw-release')).toBeAttached();await expect(page.getByRole('button',{name:'提交审批申请',exact:true})).toBeDisabled();await page.evaluate(()=>dispatchEvent(new Event('offline')));await expect(page.getByTestId('raw-release')).toHaveCount(0);await page.getByRole('button',{name:'重新验证访问条件',exact:true}).click();await authorized(page);await expect(page.getByTestId('raw-release')).toBeAttached();expect(new URL(page.url()).pathname).toBe(path);expect(networkRows().filter(r=>r.method==='POST')).toHaveLength(count);});
  21 | 
```