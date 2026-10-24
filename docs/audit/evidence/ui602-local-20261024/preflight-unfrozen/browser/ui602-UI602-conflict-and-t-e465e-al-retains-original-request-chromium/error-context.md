# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui602.spec.ts >> UI602 conflict and throttling never publish raw errors or forged success; unknown refusal retains original request
- Location: tests/e2e/ui602.spec.ts:13:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('main').getByRole('alert')
Expected substring: "冷却"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('main').getByRole('alert')

```

```yaml
- link "跳至正文":
  - /url: "#_r_0_"
- banner:
  - button "折叠侧栏" [expanded]: SUMALPHA
  - text: ▣ 33333333 44444444 PAPER
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
  - paragraph: WORKSPACE GOVERNANCE
  - heading "Admin · 角色" [level=1]
  - button "切换主题"
  - button "重新读取治理目录"
  - navigation "治理分类":
    - link "成员":
      - /url: /admin/members
    - link "角色":
      - /url: /admin/roles
    - link "策略":
      - /url: /admin/policies
    - link "能力":
      - /url: /admin/capabilities
    - link "功能开关":
      - /url: /admin/flags
  - paragraph: 所有治理操作须提供原因、MFA、近期认证与版本；删除保留墓碑及审计事实。服务端 Owner 权限与职责分离规则决定最终接受。
  - region "治理资源":
    - heading "角色目录" [level=2]
    - paragraph: 当前一致配置共 0 条，含墓碑；每类最多读取 1000 条。
    - paragraph: 尚无已核对目录；请重新读取。
    - list
    - button "新建角色" [disabled]
  - region "治理编辑":
    - heading "新建角色" [level=2]
    - group "治理字段 · role":
      - text: 治理字段 · role 角色名称
      - textbox "角色名称" [disabled]
      - text: 基础身份
      - combobox "基础身份" [disabled]:
        - option "operator" [disabled]
        - option "approver" [disabled]
        - option "viewer" [disabled] [selected]
      - group "允许权限（受基础身份上限约束）":
        - text: 允许权限（受基础身份上限约束）
        - checkbox "ops.read" [checked] [disabled]
        - text: ops.read
        - checkbox "ops.operate" [disabled]
        - text: ops.operate
        - checkbox "ops.approve" [disabled]
        - text: ops.approve
        - checkbox "admin.read" [disabled]
        - text: admin.read
        - checkbox "admin.write" [disabled]
        - text: admin.write
        - checkbox "alerts.read" [disabled]
        - text: alerts.read
    - button "审阅创建" [disabled]
  - region "治理审计回执":
    - heading "治理审计回执" [level=2]
    - paragraph: 仅显示本次会话核对的最近 25 条提交；完整历史见 Audit。回执不赋予新的会话权限。
    - list:
      - listitem:
        - strong: roles · 已提交 · v0
        - paragraph: id 84051969-f3c7-4809-92f3-d3cdbdc482ce · configVersion 1
        - paragraph: auditRef 01a16d41-e2f9-7ff0-90f0-c6bc1df24477 · correlationId 05184b8f-896d-4ce5-baf4-a24b6e039e8a
- contentinfo "连接状态": PAPER · C11 治理 configVersion 未读取 saved
- alert
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | import {writeFile} from 'node:fs/promises';
  4  | import {installReferenceHooks,authorized,networkRows,fault,probe} from './fixtures/ui602-reference';
  5  | installReferenceHooks();
  6  | const writes=()=>networkRows().filter(r=>!r.control&&r.path.startsWith('/v1/admin/')&&r.method!=='GET');
  7  | async function open(page:Page,c='roles'){await page.goto('/admin/'+c);await authorized(page);await expect(page.getByRole('button',{name:'重新读取治理目录'})).toBeEnabled();await expect(page.getByRole('region',{name:'治理资源'})).not.toContainText('尚无已核对');}
  8  | async function refresh(page:Page){await page.getByRole('button',{name:'重新读取治理目录'}).click();await expect(page.getByRole('region',{name:'治理资源'})).not.toContainText('尚无已核对');await expect(page.getByRole('region',{name:'治理资源'})).not.toContainText('正在读取');}
  9  | async function submit(page:Page,button='审阅创建'){await page.getByRole('button',{name:button,exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByLabel('操作原因',{exact:true}).fill('UI602 controlled browser governance');await page.getByLabel('MFA 验证码').fill('123456');await page.getByLabel('确认治理字段、影响与版本').check();await page.getByRole('button',{name:'提交治理操作',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
  10 | test('UI602 role create/update/delete, cancel focus, original reply recovery and retained tombstone',async({page},info)=>{await open(page);await page.getByLabel('角色名称',{exact:true}).fill('browser_reader');await page.getByRole('button',{name:'审阅创建',exact:true}).click();await page.screenshot({path:info.outputPath('admin-confirm-dark-1440.png')});await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'审阅创建',exact:true})).toBeFocused();expect(writes()).toHaveLength(0);fault({drop:true});await submit(page);await expect(page.getByRole('region',{name:'操作结果未知'})).toBeVisible();await expect(page.getByRole('button',{name:'重新读取治理目录'})).toBeDisabled();await page.getByRole('button',{name:'恢复原请求'}).click();await expect(page.getByRole('region',{name:'治理审计回执'})).toContainText('roles · 已提交');expect(writes()).toHaveLength(2);for(const k of ['bodyHash','keyHash','version','responseHash'] as const)expect(writes()[0][k]).toBe(writes()[1][k]);await refresh(page);await page.getByRole('button',{name:/^browser_reader /}).click();await page.getByLabel('角色名称',{exact:true}).fill('browser_reader_v2');await submit(page,'审阅修改');await refresh(page);await page.getByRole('button',{name:/^browser_reader_v2 /}).click();await submit(page,'审阅删除');await refresh(page);await expect(page.getByRole('button',{name:/^browser_reader_v2 /})).toContainText('已删除');await page.getByRole('button',{name:/^browser_reader_v2 /}).click();await expect(page.getByRole('button',{name:'审阅删除'})).toBeDisabled();expect(writes().map(r=>r.status)).toEqual([201,201,200,200]);});
  11 | test('UI602 member, policy, flag and reviewed engine capability forms persist authoritative fields',async({page})=>{await open(page,'members');await page.getByLabel('已登记 actorId').fill('66666666-6666-4666-8666-666666666666');await page.getByLabel('角色',{exact:true}).selectOption({label:'operator'});await submit(page);await expect(page.getByRole('region',{name:'治理审计回执'})).toContainText('members · 已提交');await open(page,'policies');await page.getByLabel('策略名称').fill('browser_deny_alert');await page.getByRole('group',{name:'拒绝权限'}).getByLabel('alerts.read',{exact:true}).check();await submit(page);await expect(page.getByRole('region',{name:'治理审计回执'})).toContainText('policies · 已提交');await open(page,'flags');await page.getByRole('button',{name:/^admin-catalog-preview /}).click();await page.getByLabel('发布比例（0–100）').fill('25');await submit(page,'审阅修改');await expect(page.getByRole('region',{name:'治理审计回执'})).toContainText('feature-flags · 已提交');await open(page,'capabilities');await page.getByLabel('能力类别').selectOption('engine_capability');const select=page.getByLabel('签名审查目录');await select.selectOption({index:1});await page.getByLabel('Engine 能力启用',{exact:true}).check();await submit(page);await expect(page.getByRole('region',{name:'治理审计回执'})).toContainText('capabilities · 已提交');expect(writes().map(r=>r.status)).toEqual([201,201,200,201]);});
  12 | test('UI602 last-admin refusal is atomic, protected roles are read only and no permission is invented',async({page})=>{await open(page,'capabilities');await page.getByRole('button',{name:/^admin.read /}).click();await page.getByLabel('能力启用',{exact:true}).uncheck();await submit(page,'审阅修改');await expect(page.locator('main').getByRole('alert')).toContainText('治理保护拒绝');await expect(page.getByRole('region',{name:'治理审计回执'})).toContainText('尚无已核对提交');await refresh(page);await page.getByRole('button',{name:/^admin.read /}).click();await expect(page.getByLabel('能力启用',{exact:true})).toBeChecked();await open(page);await page.getByRole('button',{name:/^owner /}).click();await expect(page.getByRole('button',{name:'审阅修改'})).toBeDisabled();await expect(page.getByRole('button',{name:'审阅删除'})).toBeDisabled();expect(writes().map(r=>r.status)).toEqual([409]);});
> 13 | test('UI602 conflict and throttling never publish raw errors or forged success; unknown refusal retains original request',async({page})=>{await open(page);probe('SYNTHETIC_HTTP_429_409');await page.getByLabel('角色名称',{exact:true}).fill('browser_conflict');await page.route('**/v1/admin/roles',r=>r.request().method==='POST'?r.fulfill({status:429,json:{code:'RATE_LIMITED',message:'private SQL secret',retryAfter:1,correlationId:'aaaaaaaa-1111-4111-8111-111111111111'}}):r.continue());await submit(page);await expect(page.locator('main').getByRole('alert')).toContainText('冷却');await expect(page.locator('main')).not.toContainText('private SQL');await page.unroute('**/v1/admin/roles');await expect(page.getByRole('button',{name:'重新读取治理目录'})).toBeEnabled();await refresh(page);await page.getByLabel('角色名称',{exact:true}).fill('browser_unknown');fault({drop:true});await submit(page);await expect(page.getByRole('region',{name:'操作结果未知'})).toBeVisible();await page.route('**/v1/admin/roles',r=>r.request().method==='POST'?r.fulfill({status:409,json:{code:'IDEMPOTENCY_CONFLICT',message:'private',correlationId:'aaaaaaaa-1111-4111-8111-111111111111'}}):r.continue());await page.getByRole('button',{name:'恢复原请求'}).click();await expect(page.locator('main').getByRole('alert')).toContainText('操作结果未知');await expect(page.getByRole('button',{name:'重新读取治理目录'})).toBeDisabled();await page.unroute('**/v1/admin/roles');await page.getByRole('button',{name:'恢复原请求'}).click();await expect(page.getByRole('region',{name:'治理审计回执'})).toContainText('roles · 已提交');});
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             ^ Error: expect(locator).toContainText(expected) failed
  14 | test('UI602 scope query/denied identity, mobile and offline cannot retain governance authority',async({page})=>{await open(page);await page.getByLabel('角色名称',{exact:true}).fill('mobile_denied');await page.setViewportSize({width:390,height:941});await expect(page.getByRole('button',{name:'审阅创建'})).toBeDisabled();await page.evaluate(()=>dispatchEvent(new Event('offline')));await expect(page.getByRole('heading',{name:'Admin 访问不可用'})).toBeVisible();await expect(page.getByRole('region',{name:'治理资源'})).toHaveCount(0);const n=networkRows().length;await page.goto('/admin/roles?accountId=forged');await expect(page.getByRole('heading',{name:'Admin 访问不可用'})).toBeVisible();expect(networkRows()).toHaveLength(n);fault({readonly:true});await page.goto('/admin/roles');await expect(page.getByRole('heading',{name:'Admin 访问不可用'})).toBeVisible();expect(writes()).toHaveLength(0);});
  15 | test('UI602 dark/light 1440/390 functional pages, read-only mobile and axe',async({page},info)=>{await open(page);const scans=[];for(const theme of ['dark','light'] as const){await page.emulateMedia({colorScheme:theme});await expect(page.locator('[data-quantos-theme]')).toHaveAttribute('data-quantos-theme',theme);for(const width of [1440,390]){await page.setViewportSize({width,height:941});await page.locator('main').evaluate(e=>e.scrollTop=0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const scan=await new AxeBuilder({page}).analyze();scans.push({theme,width,violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath('ui602-axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scans,manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));expect(scan.violations).toEqual([]);await page.screenshot({path:info.outputPath(`admin-${theme}-${width}.png`)});}}expect(writes()).toHaveLength(0);});
  16 | 
```