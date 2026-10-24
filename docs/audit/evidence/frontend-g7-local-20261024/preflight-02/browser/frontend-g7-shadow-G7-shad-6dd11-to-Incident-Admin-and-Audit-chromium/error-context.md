# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend-g7-shadow.spec.ts >> G7 shadow browser business segments preserve independent sources and continue into Incident Admin and Audit
- Location: tests/e2e/fixtures/g7-journeys.ts:9:6

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '成员与角色', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: '成员与角色', exact: true })

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
    - link "Alerts":
      - /url: /alerts
    - link "Operations":
      - /url: /operations
    - link "Admin":
      - /url: /admin/members
- main:
  - paragraph: Admin / members / new
  - heading "Administration" [level=1]
  - paragraph: 当前工作区 · 成员、策略、能力与功能治理
  - button "导出成员清单" [disabled]
  - button "查看治理审计" [disabled]
  - button "重新读取治理目录"
  - button "切换主题"
  - text: Admin · 可提交
  - complementary: ⓘ 当前工作区 33333333-3333-4333-8333-333333333333 · 账户 44444444-4444-4444-8444-444444444444 · SHADOW。治理不能提升原始身份权限。
  - navigation "治理分类":
    - link "成员 4":
      - /url: /admin/members
    - link "角色 5":
      - /url: /admin/roles
    - link "策略 0":
      - /url: /admin/policies
    - link "能力 5":
      - /url: /admin/capabilities
    - link "功能开关 3":
      - /url: /admin/flags
  - region "治理概览":
    - article:
      - paragraph: 有效成员
      - strong: "4"
      - paragraph: Owner 成员（actor）
      - text: "1"
    - article:
      - paragraph: 策略总数
      - strong: "0"
      - paragraph: 有效拒绝策略
      - text: "0"
    - article:
      - paragraph: Engine 能力
      - strong: "0"
      - paragraph: 配置为启用
      - text: "0"
    - article:
      - paragraph: 功能开关
      - strong: "3"
      - paragraph: 已启用
      - text: "3"
  - region "治理资源":
    - heading "成员治理目录" [level=2]
    - paragraph: 已核对配置中的资源 · 删除保留墓碑与审计
    - button "新建成员"
    - text: 搜索治理资源
    - searchbox "搜索治理资源"
    - text: 治理状态筛选
    - combobox "治理状态筛选":
      - option "全部状态" [selected]
      - option "启用"
      - option "停用"
      - option "受保护"
      - option "已删除"
    - table "成员资源表格":
      - caption: 成员资源表格
      - rowgroup:
        - row "资源 / 类型 版本 状态 边界":
          - columnheader "资源 / 类型"
          - columnheader "版本"
          - columnheader "状态"
          - columnheader "边界"
      - rowgroup:
        - row "11111111-1111-4111-8111-111111111111 members · v0 · 启用 成员 · 11111111-1111-4111-8111-111111111111 v0 启用 服务端校验":
          - cell "11111111-1111-4111-8111-111111111111 members · v0 · 启用 成员 · 11111111-1111-4111-8111-111111111111":
            - button "11111111-1111-4111-8111-111111111111 members · v0 · 启用"
            - text: 成员 · 11111111-1111-4111-8111-111111111111
          - cell "v0"
          - cell "启用"
          - cell "服务端校验"
        - row "842e725a-2892-4388-8d3c-7eb11d8c54ab members · v0 · 启用 成员 · 842e725a-2892-4388-8d3c-7eb11d8c54ab v0 启用 服务端校验":
          - cell "842e725a-2892-4388-8d3c-7eb11d8c54ab members · v0 · 启用 成员 · 842e725a-2892-4388-8d3c-7eb11d8c54ab":
            - button "842e725a-2892-4388-8d3c-7eb11d8c54ab members · v0 · 启用"
            - text: 成员 · 842e725a-2892-4388-8d3c-7eb11d8c54ab
          - cell "v0"
          - cell "启用"
          - cell "服务端校验"
        - row "8e3f57fd-4f05-4b1f-93fb-a5cdb6b3955f members · v0 · 启用 成员 · 8e3f57fd-4f05-4b1f-93fb-a5cdb6b3955f v0 启用 服务端校验":
          - cell "8e3f57fd-4f05-4b1f-93fb-a5cdb6b3955f members · v0 · 启用 成员 · 8e3f57fd-4f05-4b1f-93fb-a5cdb6b3955f":
            - button "8e3f57fd-4f05-4b1f-93fb-a5cdb6b3955f members · v0 · 启用"
            - text: 成员 · 8e3f57fd-4f05-4b1f-93fb-a5cdb6b3955f
          - cell "v0"
          - cell "启用"
          - cell "服务端校验"
        - row "d8f9ced5-c1f4-435f-acc4-3b237326ea4f members · v0 · 启用 成员 · d8f9ced5-c1f4-435f-acc4-3b237326ea4f v0 启用 服务端校验":
          - cell "d8f9ced5-c1f4-435f-acc4-3b237326ea4f members · v0 · 启用 成员 · d8f9ced5-c1f4-435f-acc4-3b237326ea4f":
            - button "d8f9ced5-c1f4-435f-acc4-3b237326ea4f members · v0 · 启用"
            - text: 成员 · d8f9ced5-c1f4-435f-acc4-3b237326ea4f
          - cell "v0"
          - cell "启用"
          - cell "服务端校验"
    - text: 当前一致配置共 4 条，含墓碑；每类最多读取 1000 条。 4 条匹配 · 本页 4 条
    - button "上一页治理资源" [disabled]: ‹
    - text: 1 / 1
    - button "下一页治理资源" [disabled]: ›
  - region "治理审计回执":
    - heading "本会话提交记录" [level=2]
    - paragraph: 仅显示本次会话核对的最近 25 条提交；完整历史见 Audit。回执不赋予新的会话权限。
    - text: 非完整版本历史
    - paragraph: 尚无已核对提交。
  - region "治理编辑":
    - paragraph: 成员详情
    - heading "新建成员" [level=2]
    - button "复制 ID" [disabled]
    - button "关闭治理详情"
    - region "资源身份详情":
      - heading "01 身份与治理来源" [level=3]
      - paragraph: 选择目录资源查看事实；新建变更将在审阅后提交。
    - region "权限与能力边界":
      - heading "02 权限与能力边界" [level=3]
      - paragraph: 字段受当前原始身份与服务端治理规则约束。
    - region "审查与职责分离":
      - heading "03 审查与职责分离" [level=3]
      - term: 治理读权限
      - definition: 已核对
      - term: 治理写权限
      - definition: 会话已授予
      - term: 最后管理员
      - definition: 服务端强制保护
      - term: 职责分离
      - definition: 提交时服务端校验
      - term: MFA / 近期认证
      - definition: 每次提交重新验证
    - region "提交受控变更":
      - heading "04 提交受控变更" [level=3]
      - button "查看字段差异"
      - group "治理字段 · member":
        - text: 治理字段 · member 已登记 actorId
        - textbox "已登记 actorId"
        - text: 角色
        - combobox "角色":
          - option "选择现有角色"
          - option "approver"
          - option "viewer" [selected]
          - option "service"
          - option "owner"
          - option "operator"
        - checkbox "成员有效" [checked]
        - text: 成员有效
        - paragraph: 只管理已登记身份；不能邀请用户或提升原始身份权限。当前用户变更由服务端职责分离规则拒绝。
      - button "审阅创建" [disabled]
    - text: Object version 新建 MFA · 提交时验证 职责分离 · 服务端强制
  - text: ⚠ 管理权限不能绕过风险、审批或执行边界。 服务未提供完整审批历史、逐项签名证据、持续治理流及成员导出。
- contentinfo "连接状态": "SHADOW · C01 授权 configVersion 0 Governance stream: 未提供 所有治理变更保留版本与审计"
- alert
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import {writeFile,readFile} from 'node:fs/promises';
  3  | import AxeBuilder from '@axe-core/playwright';
  4  | import {authorized,control,useSession,businessReceipts,networkRows} from './frontend-g7-reference';
  5  | 
  6  | async function approve(approvalId:string,version:string){const opts={method:'POST' as const,session:'session-approver' as const},m=await control('/v1/auth/mfa/challenges',{purpose:'security_change',code:'123456'},undefined,opts),g=await control('/v1/auth/reauth',{challengeRef:m.body.challengeRef},undefined,opts);expect((await control('/v1/approvals/'+approvalId+'/decisions',{decision:'approve',mfaChallengeRef:m.body.challengeRef,reauthTokenRef:g.body.reauthTokenRef},version,opts)).status).toBe(200);}
  7  | async function opsSubmit(page:Page,button:string){await page.getByRole('button',{name:button,exact:true}).click();await page.getByLabel('操作原因',{exact:true}).fill('G7 same process business segments');await page.getByLabel('MFA 验证码').fill('123456');await page.getByLabel('确认当前动作、来源与版本').check();await page.getByRole('button',{name:'提交运维操作',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
  8  | export function journey(mode:'paper'|'shadow'){
  9  |  test(`G7 ${mode} browser business segments preserve independent sources and continue into Incident Admin and Audit`,async({page},info)=>{
  10 |  test.setTimeout(90000);const segments:Record<string,unknown>[]=[];
  11 |  if(mode==='paper'){
  12 |  await page.goto('/strategies');await authorized(page);await page.locator('a[href$="/lab"]').first().click();await authorized(page);await expect(page.getByRole('status').filter({hasText:'已保存 · objectVersion：'})).toBeVisible();
  13 |  await page.getByRole('button',{name:'运行静态检查',exact:true}).click();await expect(page.getByText(/通过 · v/)).toBeVisible();await page.getByRole('button',{name:'创建回测',exact:true}).click();await page.getByRole('link',{name:/回测报告 v/}).first().click();await authorized(page);await page.getByRole('button',{name:'创建不可变 Release',exact:true}).click();await page.getByRole('link',{name:'查看 Release 详情',exact:true}).click();await authorized(page);await page.getByRole('button',{name:'提交审批申请',exact:true}).click();await expect(page.getByText(/服务端状态：pending/)).toBeVisible();const pending=JSON.parse((await page.getByTestId('raw-release').textContent())!);await approve(pending.approvalRef,'0');await page.getByRole('button',{name:'刷新 Release 与审批',exact:true}).click();await expect(page.getByText(/服务端状态：approved/)).toBeVisible();await page.getByLabel('目标选择',{exact:true}).selectOption('paper');segments.push({kind:'SEEDED_STRATEGY_TO_APPROVED_RELEASE',releaseId:pending.releaseId,targetSelection:'CLIENT_SELECTION_ONLY_NO_ACTIVATION'});
  14 |  await page.goto('/trade/BTCUSDT');await authorized(page);await page.getByLabel('Proposal',{exact:true}).selectOption({index:1});await page.getByLabel('行情参考',{exact:true}).selectOption({index:1});await page.getByRole('button',{name:'读取并重新核查',exact:true}).click();await page.getByRole('button',{name:'重新核查并继续',exact:true}).click();await page.getByRole('button',{name:'重新核查并预填 intent',exact:true}).click();await expect(page.getByTestId('intent-ready')).toBeVisible();
  15 |  for(const action of ['risk','command'] as const){if(action==='command'){const a=((await control('/v1/approvals',undefined,undefined,{session:'session-current'})).body.items as Record<string,unknown>[]).find(a=>a.status==='pending')!;await approve(String(a.approvalId),String(a.objectVersion));await page.getByRole('button',{name:'读取风险与审批状态',exact:true}).click();}await page.getByRole('button',{name:action==='risk'?'运行风险评估':'提交服务端 Command',exact:true}).click();const dialog=page.getByRole('dialog'),phrase=action==='risk'?'EVALUATE RISK':'SUBMIT COMMAND';await dialog.getByLabel(`输入“${phrase}”以确认`).fill(phrase);await dialog.getByRole('button',{name:action==='risk'?'确认风险评估申请':'确认提交 Command',exact:true}).click();if(action==='risk')await expect(page.getByTestId('ticket-approval')).toContainText('pending');}
  16 |  await expect(page.getByRole('region',{name:'Command 受理回执',exact:true})).toContainText('accepted');const ctx=await control('/v1/context',undefined,undefined,{session:'session-current'}),orders=await control('/v1/orders?accountId='+ctx.body.accountId,undefined,undefined,{session:'session-current'}),order=(orders.body.items as Record<string,unknown>[])[0]!;expect(order.releaseId).not.toBe(pending.releaseId);await page.goto('/orders/'+order.orderId);await authorized(page);await page.getByRole('button',{name:'请求撤单',exact:true}).click();const d=page.getByRole('dialog');await d.getByLabel('输入“CANCEL ORDER”以确认').fill('CANCEL ORDER');await d.getByRole('button',{name:'确认撤单请求',exact:true}).click();await expect(page.locator('.p11-detail-title')).toContainText('cancelled');segments.push({kind:'INDEPENDENT_SEEDED_PROPOSAL_TO_CANCELLED_ORDER',orderId:order.orderId,releaseId:order.releaseId,correlationId:order.correlationId});await page.goto('/audit/'+order.correlationId);await authorized(page);await expect(page.getByText('当前授权范围内链完整',{exact:true})).toBeVisible();
  17 |  }else{
  18 |  await page.goto('/performance');await authorized(page);await expect(page.getByRole('region',{name:'收益来源',exact:true})).toBeVisible();await page.getByRole('button',{name:'生成收益报表',exact:true}).click();const panel=page.getByRole('region',{name:'固定版本报告',exact:true});await expect(panel).toContainText('queued');await panel.getByRole('button',{name:'刷新此报告状态',exact:true}).click();await expect(panel).toContainText('succeeded');const download=page.waitForEvent('download');await panel.getByRole('button',{name:'校验并下载 JSON',exact:true}).click();const doc=JSON.parse((await readFile((await(await download).path())!)).toString());expect(doc.metadata.provisional).toBe(true);expect(doc.performance.ledgerVersion).toBe(doc.metadata.ledgerVersion);segments.push({kind:'SHADOW_C15_C14_FROZEN_REPORT',metadata:doc.metadata});await panel.getByRole('link',{name:/查看报告 Audit/}).click();await authorized(page);await expect(page.getByText('当前授权范围内链完整',{exact:true})).toBeVisible();
  19 |  }
  20 |  await page.goto('/alerts');await authorized(page);await expect(page.getByRole('region',{name:'告警详情',exact:true})).toContainText('来源活跃，尚未解决');const alertId=(await page.getByRole('region',{name:'告警详情',exact:true}).locator('.p23-summary-facts dd').first().innerText()).trim();await page.getByRole('link',{name:'打开 Operations',exact:true}).click();await authorized(page);await page.getByRole('button',{name:'读取创建来源 '+alertId.slice(0,8),exact:true}).click();await opsSubmit(page,'准备创建 Incident');await opsSubmit(page,'准备确认 Incident');const incident=businessReceipts().find(r=>r.incidentId)!;expect(incident.alertId).toBe(alertId);expect(incident.mode).toBe(mode);await page.screenshot({path:info.outputPath(`g7-${mode}-incident.png`)});
> 21 |  useSession('session-owner');await page.goto('/admin/members');await authorized(page);await expect(page.getByRole('heading',{name:'成员与角色',exact:true})).toBeVisible();useSession('session-current');const chain=await control('/v1/audit/evidence-chains/'+incident.correlationId,undefined,undefined,{session:'session-current'});expect(chain.status).toBe(200);expect((chain.body.items as {eventId:string}[]).some(e=>e.eventId===incident.auditRef)).toBe(true);
     |                                                                                                                                                         ^ Error: expect(locator).toBeVisible() failed
  22 |  await page.goto('/audit/'+incident.correlationId);await authorized(page);const scan=await new AxeBuilder({page}).analyze();expect(scan.violations).toEqual([]);await writeFile(info.outputPath('g7-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,mode,violations:scan.violations,incomplete:scan.incomplete,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));
  23 |  await page.setViewportSize({width:390,height:1000});await page.goto('/alerts');await authorized(page);await expect(page.getByRole('button',{name:'准备标记已读',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'告警详情',exact:true})).toBeVisible();
  24 |  await writeFile(info.outputPath('g7-journey.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,mode,scope:'SINGLE_PROCESS_SEGMENTS_WITH_EXPLICIT_SOURCE_GAPS',segments,incident,sourceResolved:false,releaseToProposal:'NOT_JOINED',paperOrderToShadowLedger:'NOT_JOINED',smallScreenWrites:false,writes:networkRows().filter(r=>!r.control&&r.method!=='GET').map(r=>({path:r.path,status:r.status}))},null,2));
  25 |  });
  26 | }
  27 | 
```