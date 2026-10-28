# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core-l4.spec.ts >> CORE L4 current P10 P11 mTLS common C10 read and recovery
- Location: tests/e2e/core-l4.spec.ts:7:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('main')
Expected substring: "assisted.command_accepted"
Received string:    "Audit / 01a182c8-9182-7f22-acd0-…Audit Explorer检索当前授权范围内的审计事件与因果证据链。☀ 浅色筛选条件固定筛选当前模式仅支持共同审计查询，导出尚未开放。⌕审计关联搜索检索关联请求未完成，请核对条件后显式重试。0 个本页对象引用0 个本页事件链完整性待读取字段由服务端脱敏所有时间 UTC筛选条件服务端检索Correlation IDCausation ID对象引用事件类型开始时间（本地输入）结束时间（本地输入）服务端排序时间降序时间升序事件类型升序每页条数52550100搜索清除条件无权对象不会出现在检索结果中。固定仅锁定本页筛选输入，不保存到设备。检索结果 0时间 UTC尚未读取事件，请搜索。按需读取下一页事件EvidenceTimeline读取关联链时间线 / 因果引用复制 correlation ID选择一个检索结果读取当前授权因果链。◉ 关联节点 ◇ 服务端脱敏 △ 不代表签名验签事件详情选择事件查看详情。授权、脱敏与恢复边界只展示当前授权范围内的C10快照。身份撤权流不代表审计领域实时订阅。受控导出必须在线、桌面权限与近期认证；未知创建结果仅在当前页面保留原意图，离开后请先查审计确认事实再创建。详情中的服务端路由只作文本引用，不自动访问外部地址。"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('main')
    14 × locator resolved to <main id="_r_0_" tabindex="-1" data-smoke="route-/audit" class="q-workspace-main p12-main">…</main>
       - unexpected value "Audit / 01a182c8-9182-7f22-acd0-…Audit Explorer检索当前授权范围内的审计事件与因果证据链。☀ 浅色筛选条件固定筛选当前模式仅支持共同审计查询，导出尚未开放。⌕审计关联搜索检索关联请求未完成，请核对条件后显式重试。0 个本页对象引用0 个本页事件链完整性待读取字段由服务端脱敏所有时间 UTC筛选条件服务端检索Correlation IDCausation ID对象引用事件类型开始时间（本地输入）结束时间（本地输入）服务端排序时间降序时间升序事件类型升序每页条数52550100搜索清除条件无权对象不会出现在检索结果中。固定仅锁定本页筛选输入，不保存到设备。检索结果 0时间 UTC尚未读取事件，请搜索。按需读取下一页事件EvidenceTimeline读取关联链时间线 / 因果引用复制 correlation ID选择一个检索结果读取当前授权因果链。◉ 关联节点 ◇ 服务端脱敏 △ 不代表签名验签事件详情选择事件查看详情。授权、脱敏与恢复边界只展示当前授权范围内的C10快照。身份撤权流不代表审计领域实时订阅。受控导出必须在线、桌面权限与近期认证；未知创建结果仅在当前页面保留原意图，离开后请先查审计确认事实再创建。详情中的服务端路由只作文本引用，不自动访问外部地址。"

```

```yaml
- main:
  - paragraph: Audit / 01a182c8-9182-7f22-acd0-…
  - heading "Audit Explorer" [level=1]
  - paragraph: 检索当前授权范围内的审计事件与因果证据链。
  - button "切换主题": ☀ 浅色
  - button "筛选条件" [expanded]
  - button "固定筛选"
  - status: 当前模式仅支持共同审计查询，导出尚未开放。
  - text: 审计关联搜索
  - textbox "审计关联搜索":
    - /placeholder: Correlation ID · 当前授权证据链
    - text: 01a182c8-9182-7f22-acd0-89084459e63f
  - button "检索关联"
  - status: 请求未完成，请核对条件后显式重试。
  - text: 0 个本页对象引用 0 个本页事件 链完整性待读取 字段由服务端脱敏 所有时间 UTC
  - region "审计搜索":
    - heading "筛选条件" [level=2]
    - text: 服务端检索
    - group:
      - text: Correlation ID
      - textbox "Correlation ID": 01a182c8-9182-7f22-acd0-89084459e63f
      - text: Causation ID
      - textbox "Causation ID"
      - text: 对象引用
      - textbox "对象引用"
      - text: 事件类型
      - textbox "事件类型"
      - text: 开始时间（本地输入）
      - textbox "开始时间（本地输入）"
      - text: 结束时间（本地输入）
      - textbox "结束时间（本地输入）"
      - text: 服务端排序
      - combobox "服务端排序":
        - option "时间降序" [selected]
        - option "时间升序"
        - option "事件类型升序"
      - text: 每页条数
      - combobox "每页条数":
        - option "5"
        - option "25" [selected]
        - option "50"
        - option "100"
    - button "搜索"
    - button "清除条件"
    - paragraph: 无权对象不会出现在检索结果中。固定仅锁定本页筛选输入，不保存到设备。
  - region "检索结果":
    - heading "检索结果 0" [level=2]
    - text: 时间 UTC
    - paragraph: 尚未读取事件，请搜索。
    - text: 按需读取
    - button "下一页事件" [disabled]
  - region "因果证据链":
    - heading "EvidenceTimeline" [level=2]
    - button "读取关联链"
    - text: 时间线 / 因果引用
    - button "复制 correlation ID" [disabled]
    - paragraph: 选择一个检索结果读取当前授权因果链。
    - text: ◉ 关联节点 ◇ 服务端脱敏 △ 不代表签名验签
  - region "事件详情":
    - heading "事件详情" [level=2]
    - paragraph: 选择事件查看详情。
  - group: 授权、脱敏与恢复边界
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import {writeFile} from 'node:fs/promises';
  4  | import {installReferenceHooks,useSession,authorized,control,fault,networkRows,zoneSnapshot} from './fixtures/frontend-g8-reference';
  5  | installReferenceHooks('assisted-mtls-local');
  6  | const ack='我已核对账户、方向、数量、限价、对象指纹与审批状态';
  7  | test('CORE L4 current P10 P11 mTLS common C10 read and recovery',async({page},info)=>{
  8  |  useSession('session-current');await page.goto('/approvals');await authorized(page);await expect(page.getByTestId('assisted-native-condition')).toContainText('条件有效');await page.getByLabel('已核查的 Proposal').selectOption({index:1});await page.getByRole('button',{name:'发起双人审批',exact:true}).click();await expect(page.getByTestId('assisted-approval-status')).toContainText('pending');
  9  |  const open=await control('/v1/assisted-testnet/requests',undefined,undefined,{session:'session-current'}),row=(open.body.items as {request:{requestId:string};subject:{subjectHash:string}}[])[0],id=row.request.requestId,path='/v1/assisted-testnet/requests/'+id;
  10 |  for(const [slot,who]of (['session-approver','session-owner'] as const).entries()){
  11 |   useSession(who);await page.goto('/approvals');await authorized(page);await page.getByRole('button',{name:new RegExp(id)}).click();await expect(page.getByTestId('assisted-approval-status')).toContainText(slot===0?'pending':'awaiting_second');await page.getByLabel(ack,{exact:true}).check();await page.getByRole('button',{name:'独立审批并验证 MFA',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('输入“APPROVE TESTNET”以确认').fill('APPROVE TESTNET');await dialog.getByLabel('MFA 验证码',{exact:true}).fill('123456');if(slot===0)fault({dropPath:path+'/approvals'});await dialog.getByRole('button',{name:'验证并批准',exact:true}).click();
  12 |   if(slot===0){await expect(page.getByRole('region',{name:'未知操作结果'})).toBeVisible();await page.getByRole('button',{name:'恢复原请求',exact:true}).click();}
  13 |   await expect(page.getByTestId('assisted-approval-status')).toContainText(slot===0?'awaiting_second':'approved');
  14 |  }
  15 |  useSession('session-current');await page.goto('/orders');await authorized(page);await page.getByRole('button',{name:new RegExp(id)}).click();await page.getByLabel(ack,{exact:true}).check();await page.getByRole('button',{name:'提交已双人批准的 testnet Command',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('输入“SUBMIT ASSISTED TESTNET”以确认').fill('SUBMIT ASSISTED TESTNET');fault({dropPath:path+'/commands'});await dialog.getByRole('button',{name:'确认提交 Command',exact:true}).click();await expect(page.getByRole('region',{name:'未知操作结果'})).toBeVisible();await page.getByRole('button',{name:'恢复原请求',exact:true}).click();await expect(page.getByTestId('assisted-native-order')).toContainText('filled');
  16 |  const audit=await control(path+'/audit',undefined,undefined,{session:'session-current'});expect(audit.body.verified).toBe(true);expect(audit.body.nativeSubmissions).toBe(1);expect(audit.body.items).toHaveLength(2);const latest=await control(path,undefined,undefined,{session:'session-current'});const c=latest.body.command as {commandId:string;subjectHash:string;order:{commandId:string;orderId:string}};expect(c.subjectHash).toBe(row.subject.subjectHash);expect(c.commandId).toBe(c.order.commandId);
  17 |  const nativeZone=zoneSnapshot();expect(nativeZone?.protocolCalls).toBe(1);
> 18 |  await page.getByRole('link',{name:'查看共同审计链',exact:true}).click();await authorized(page);await expect(page.getByRole('heading',{name:'Audit Explorer',exact:true})).toBeVisible();await expect(page.locator('main')).toContainText('assisted.command_accepted');await expect(page.getByRole('button',{name:'确认创建导出',exact:true})).toHaveCount(0);
     |                                                                                                                                                                                                                      ^ Error: expect(locator).toContainText(expected) failed
  19 |  const chain=await control('/v1/audit/evidence-chains/'+id,undefined,undefined,{session:'session-current'});expect(chain.status).toBe(200);expect(chain.body.items).toHaveLength(5);for(const n of chain.body.items as {route:string}[])expect(n.route).toBe('/orders?approvalId='+id);
  20 |  await page.screenshot({path:info.outputPath('core-l4-c10.png'),fullPage:true});await page.goto('/orders?approvalId='+id);await authorized(page);await expect(page.getByTestId('assisted-native-order')).toContainText(c.order.orderId);
  21 |  const axe=await new AxeBuilder({page}).analyze();expect(axe.violations).toEqual([]);await writeFile(info.outputPath('core-l4-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,violations:axe.violations,incomplete:axe.incomplete,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));await page.screenshot({path:info.outputPath('core-l4-p11.png'),fullPage:true});
  22 |  const pairs=[path+'/approvals',path+'/commands'].map(p=>networkRows().filter(r=>!r.control&&r.path===p&&r.method==='POST'));expect(pairs[0]).toHaveLength(3);expect(pairs[1]).toHaveLength(2);for(const pair of [pairs[0].slice(0,2),pairs[1]])for(const k of ['keyHash','bodyHash'] as const)expect(pair[0][k]).toBe(pair[1][k]);await writeFile(info.outputPath('core-l4-journey.json'),JSON.stringify({schema:'quantos-core-l4-browser/v1',sourceCommit:process.env.GITHUB_SHA,identity:'EXPLICIT_REFERENCE_COOKIE_BRIDGE_NOT_REAL_IDP',venueIO:'ACTUAL_L02_MTLS_PROCESS_WITH_OWNED_L01_PORT',zone:nativeZone,c10Nodes:5,c10ReadOnly:true,orderRouteCanonical:true,requestId:id,subjectHash:c.subjectHash,commandId:c.commandId,orderId:c.order.orderId,nativeSubmissions:1,approvalAudits:2,originalPairs:2,actualTestnetConnected:false,pairs:pairs.map(p=>p.map(({keyHash,...r})=>({...r,idempotencyDigest:keyHash})))},null,2));
  23 | });
  24 | 
```