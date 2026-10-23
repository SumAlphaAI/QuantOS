# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui203.spec.ts >> UI203 labeled audit pagination is scoped; expired retention clears disclosure
- Location: tests/e2e/ui203.spec.ts:20:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('region', { name: 'C10 审计关联' })
Expected substring: "当前授权范围内链完整"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByRole('region', { name: 'C10 审计关联' })
    - locator resolved to <section aria-label="C10 审计关联">…</section>
    - unexpected value "C10 审计关联按 correlation ID 读取审计证据链，complete 仅代表当前授权范围完整。读取本次产物审计链当前关联链尚不完整correlation ID：31b38369-6011-479c-8f22-3b4cf50f035d#1 research.artifact.readeventId88888888-8888-4888-8888-888888888888causationId8b971d1a-68b8-4f11-accc-de7f8e70f8e9对象引用44444444-4444-4444-8444-444444444444payload hash（服务端）sha256:e675d2f877ac6314582dfa823ff531f21b231b2c78b2454dee3b05187faa8226保留至 UTC2027-10-23 02:31:43.166Z查看关联对象读取更多审计节点"

```

```yaml
- main:
  - navigation "Artifact 导航":
    - link "Research 列表":
      - /url: /research
    - link "输入其他产物引用":
      - /url: /artifacts
  - heading "Artifact / Evidence 详情" [level=1]
  - button "切换主题"
  - paragraph: 研究证据与审计链分别展示；哈希与版本仅按服务端事实呈现，不表示独立验签或用途批准。
  - button "重新读取产物详情"
  - alert: 引用无效、范围过大或内容不支持安全预览。
- alert
```

# Test source

```ts
  1  | import {test,expect} from "@playwright/test";
  2  | import {AxeBuilder} from "@axe-core/playwright";
  3  | import {writeFile} from "node:fs/promises";
  4  | import {authorized,networkRows,artifactFault,seed} from "./fixtures/ui203-reference";
  5  | const id="44444444-4444-4444-8444-444444444444",evidenceId="77777777-7777-4777-8777-777777777777";
  6  | const detail=(page:import('@playwright/test').Page)=>page.getByRole('region',{name:'Artifact 元数据',exact:true});
  7  | test('UI203 actual reference metadata/archive/audit and safe object/snapshot cross-jumps',async({page})=>{
  8  |  await page.goto('/artifacts/'+id);await authorized(page);await expect(detail(page)).toContainText('Synthetic reference hypothesis');await expect(detail(page)).toContainText('input hash');await expect(detail(page)).toContainText('NOT_PROVIDED');expect(networkRows().some(r=>r.path.endsWith('/attachment'))).toBe(false);await page.getByRole('button',{name:'读取归档 JSON 预览',exact:true}).click();await expect(page.getByLabel('归档 JSON 文本',{exact:true})).toContainText('Synthetic reference hypothesis');await page.getByRole('button',{name:'读取本次产物审计链',exact:true}).click();await expect(page.getByRole('region',{name:'C10 审计关联'})).toContainText('当前授权范围内链完整');await expect(page.getByRole('region',{name:'C10 审计关联'}).getByRole('link',{name:'查看关联对象',exact:true})).toHaveAttribute('href','/artifacts/'+id);
  9  |  await page.getByRole('link',{name:'查看本次读取审计',exact:true}).click();await authorized(page);await page.getByRole('tab',{name:'关联引用',exact:true}).click();await expect(page.getByRole('link',{name:'查看关联对象',exact:true})).toHaveCount(1);await page.getByRole('link',{name:'查看关联对象',exact:true}).click();await authorized(page);await expect(detail(page)).toBeVisible();await page.getByRole('link',{name:'查看输入快照',exact:true}).click();await authorized(page);await expect(page.getByRole('heading',{name:'数据快照',exact:true})).toBeVisible();expect(networkRows().filter(r=>r.method==='POST')).toHaveLength(0);
  10 | });
  11 | test('UI203 labeled domain relationships bind parent input hash and resolve Evidence back to Artifact',async({page})=>{
  12 |  const r=await seed();artifactFault('relation');await page.goto('/research/'+r.jobId);await authorized(page);await expect(page.getByRole('link',{name:evidenceId,exact:true})).toBeVisible();await page.getByRole('link',{name:evidenceId,exact:true}).click();await authorized(page);await expect(detail(page)).toContainText('C03');await expect(page.getByLabel('选中的研究证据',{exact:true})).toContainText(evidenceId);await page.getByRole('link',{name:'查看所属 Artifact',exact:true}).click();await authorized(page);await expect(detail(page)).toContainText(id);await expect(page.getByLabel('选中的研究证据',{exact:true})).toHaveCount(0);await page.getByRole('link',{name:'返回父 Research',exact:true}).click();await authorized(page);await expect(page.getByRole('link',{name:id,exact:true})).toHaveAttribute('href','/artifacts/'+id+'?runId='+r.jobId);expect(networkRows().filter(r=>r.method==='POST'&&r.port==='ACTUAL_BROWSER')).toHaveLength(0);
  13 | });
  14 | test('UI203 wrong parent relationship refuses artifact disclosure',async({page})=>{const r=await seed();artifactFault('wrong-parent');await page.goto('/artifacts/'+id+'?runId='+r.jobId);await authorized(page);await expect(page.locator('main').getByRole('alert')).toContainText('资源不存在或无权访问');await expect(detail(page)).toHaveCount(0);expect(networkRows().some(r=>r.path.startsWith('/v1/artifacts/'))).toBe(false);});
  15 | test('UI203 unknown and invalid artifact references expose no private facts',async({page})=>{await page.goto('/artifacts/66666666-6666-4666-8666-666666666666');await authorized(page);await expect(page.locator('main').getByRole('alert')).toContainText('资源不存在或无权访问');await page.goto('/artifacts?artifactId=invalid');await expect(page.getByRole('heading',{name:'Artifact 引用无效',exact:true})).toBeVisible();await expect(detail(page)).toHaveCount(0);});
  16 | test('UI203 hash mismatch refuses archive preview and clears metadata',async({page})=>{await page.goto('/artifacts/'+id);await authorized(page);await expect(detail(page)).toBeVisible();artifactFault('hash');await page.getByRole('button',{name:'读取归档 JSON 预览',exact:true}).click();await expect(page.locator('main').getByRole('alert')).toBeVisible();await expect(page.getByLabel('归档 JSON 文本',{exact:true})).toHaveCount(0);await expect(detail(page)).toHaveCount(0);});
  17 | test('UI203 offline clears all previews and restoration only rereads metadata',async({page})=>{await page.goto('/artifacts/'+id);await authorized(page);await expect(detail(page)).toBeVisible();await page.getByRole('button',{name:'读取归档 JSON 预览',exact:true}).click();await expect(page.getByLabel('归档 JSON 文本',{exact:true})).toBeVisible();const n=networkRows().filter(r=>r.path.endsWith('/attachment')).length;await page.evaluate(()=>window.dispatchEvent(new Event('offline')));await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(detail(page)).toHaveCount(0);await expect(page.getByLabel('归档 JSON 文本',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'重新验证访问条件',exact:true}).click();await authorized(page);await expect(detail(page)).toBeVisible();expect(networkRows().filter(r=>r.path.endsWith('/attachment'))).toHaveLength(n);expect(await page.evaluate(()=>[localStorage.length,sessionStorage.length])).toEqual([0,0]);});
  18 | test('UI203 capability narrowing clears facts before preview dispatch',async({page})=>{await page.goto('/artifacts/'+id);await authorized(page);await expect(detail(page)).toBeVisible();artifactFault('no-research');await page.getByRole('button',{name:'读取归档 JSON 预览',exact:true}).click();await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(detail(page)).toHaveCount(0);expect(networkRows().some(r=>r.path.endsWith('/attachment'))).toBe(false);});
  19 | test('UI203 research read does not grant audit read',async({page})=>{artifactFault('no-audit');await page.goto('/artifacts/'+id);await authorized(page);await expect(detail(page)).toBeVisible();await expect(page.getByRole('region',{name:'C10 审计关联'})).toContainText('缺少 audit:read');await expect(page.getByRole('button',{name:'读取本次产物审计链',exact:true})).toHaveCount(0);expect(networkRows().some(r=>r.path.includes('evidence-chains'))).toBe(false);});
> 20 | test('UI203 labeled audit pagination is scoped; expired retention clears disclosure',async({page})=>{await page.goto('/artifacts/'+id);await authorized(page);await expect(detail(page)).toBeVisible();artifactFault('chain-pages');await page.getByRole('button',{name:'读取本次产物审计链',exact:true}).click();await expect(page.getByRole('region',{name:'C10 审计关联'})).toContainText('尚不完整');await page.getByRole('button',{name:'读取更多审计节点',exact:true}).click();await expect(page.getByRole('region',{name:'C10 审计关联'})).toContainText('当前授权范围内链完整');await expect(page.getByRole('region',{name:'C10 审计关联'}).locator('li')).toHaveCount(2);expect(networkRows().some(r=>r.path.includes('evidence-chains')&&r.query?.includes('cursor=synthetic-next'))).toBe(true);expect(await page.locator('main').innerText()).not.toContain('DO_NOT_FOLLOW');artifactFault('chain-expired');await page.getByRole('button',{name:'读取本次产物审计链',exact:true}).click();await expect(page.locator('main').getByRole('alert')).toContainText('保留期或游标已失效');await expect(detail(page)).toHaveCount(0);});
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      ^ Error: expect(locator).toContainText(expected) failed
  21 | test('UI203 untrusted summary stays text and arbitrary URLs are never activated',async({page})=>{artifactFault('xss');await page.goto('/artifacts/'+id);await authorized(page);await expect(detail(page)).toContainText('<img');await expect(page.locator('main img')).toHaveCount(0);expect(await page.evaluate(()=>Boolean((window as Window&{unsafeExecuted?:boolean}).unsafeExecuted))).toBe(false);expect(networkRows().every(r=>r.path.startsWith('/v1/'))).toBe(true);});
  22 | for(const theme of ['dark','light']as const)test(`UI203 ${theme} responsive metadata/evidence/preview and axe`,async({page},info)=>{await page.emulateMedia({colorScheme:theme});await page.goto('/artifacts/'+id);await authorized(page);await expect(detail(page)).toBeVisible();await page.getByRole('button',{name:'读取归档 JSON 预览',exact:true}).click();await expect(page.getByLabel('归档 JSON 文本',{exact:true})).toBeVisible();const scans=[];for(const width of [1440,390]){await page.setViewportSize({width,height:900});const scan=await new AxeBuilder({page}).analyze();scans.push({width,violations:scan.violations,incomplete:scan.incomplete});await writeFile(info.outputPath('axe.json'),JSON.stringify({sourceCommit:process.env.GITHUB_SHA,theme,scans,priorIncomplete:{icons:6,headers:2,p03:12},manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN'},null,2));expect(scan.violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`ui203-${theme}-${width}.png`),fullPage:true});}await page.getByRole('link',{name:'输入其他产物引用',exact:true}).click();await authorized(page);await page.getByLabel('Artifact ID',{exact:true}).fill(id.toUpperCase());await page.getByRole('button',{name:'读取产物',exact:true}).click();await authorized(page);await expect(detail(page)).toBeVisible();});
  23 | 
```