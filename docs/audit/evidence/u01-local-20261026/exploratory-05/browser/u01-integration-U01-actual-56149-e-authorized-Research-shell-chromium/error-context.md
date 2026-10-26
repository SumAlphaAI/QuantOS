# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: u01-integration.spec.ts >> U01 actual BFF MFA rejection and verification return to the authorized Research shell
- Location: tests/e2e/u01-integration.spec.ts:55:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  1  | import {test,expect,type Page} from "@playwright/test";
  2  | import {writeFile} from "node:fs/promises";
  3  | import {authorized,control,executeWorker,fault,installReferenceHooks,networkRows,snapshotId} from "./fixtures/u01-reference";
  4  | installReferenceHooks();
  5  | async function create(page:Page){
  6  |  await page.goto('/research/new');await authorized(page);
  7  |  await page.getByLabel('研究问题',{exact:true}).fill('Validate bounded BTC momentum with owned U01 input');
  8  |  await page.getByLabel('数据快照',{exact:true}).selectOption(snapshotId());
  9  |  await page.getByLabel('预算（整数成本单位）',{exact:true}).fill('250');
  10 |  await page.getByRole('checkbox',{name:'我已确认任务不包含交易指令',exact:true}).check();
  11 |  await page.getByRole('button',{name:'提交研究',exact:true}).click();
  12 |  await expect(page.getByRole('region',{name:'研究受理回执',exact:true})).toBeVisible();
  13 |  const link=page.getByRole('link',{name:'查看研究详情',exact:true}),path=(await link.getAttribute('href'))!;
  14 |  await link.click();await authorized(page);await expect(page.getByTestId('research-status')).toContainText('queued');
  15 |  return path;
  16 | }
  17 | test('U01 Web create streams actual R03 RD-Agent output and resolves Artifact Evidence Snapshot Audit',async({page},info)=>{
  18 |  const path=await create(page);await expect(page.getByTestId('research-sequence')).toHaveText('1');
  19 |  const result=await executeWorker();expect(result.results).toHaveLength(1);
  20 |  const record=result.results[0].record;expect(result.results[0].bffRunId).toBe(path.split('/').at(-1));expect(record.output.artifact_type).toBe('ResearchArtifact');expect(record.stream_events.length).toBeGreaterThan(0);
  21 |  await expect(page.getByTestId('research-status')).toContainText('succeeded');await expect.poll(async()=>Number(await page.getByTestId('research-sequence').textContent())).toBeGreaterThanOrEqual(2);
  22 |  const fact=(await control(path.replace('/research/','/v1/research-runs/'))).body;expect(fact.artifactRefs).toContain(record.artifact_manifest.artifact_id);expect(fact.evidenceRefs.length).toBeGreaterThan(0);
  23 |  const attachment=(await control(`/v1/artifacts/${record.artifact_manifest.artifact_id}/attachment`)).body;expect(attachment.content).toEqual(record.output);expect(attachment.contentHash).toBe(record.artifact_manifest.content_hash);
  24 |  const chain=(await control(`/v1/audit/evidence-chains/${fact.correlationId}`)).body;expect(chain.items.some((e:{kind:string})=>e.kind==='research.worker.completed')).toBe(true);
  25 |  await page.getByRole('link',{name:record.artifact_manifest.artifact_id,exact:true}).click();await authorized(page);await expect(page.getByRole('region',{name:'Artifact 元数据',exact:true})).toContainText('r03-worker-owned-uds');
  26 |  await page.goto(path);await authorized(page);await page.getByRole('link',{name:fact.evidenceRefs[0],exact:true}).click();await authorized(page);await expect(page.getByRole('region',{name:'Artifact 元数据',exact:true})).toBeVisible();
  27 |  await page.goto(path);await authorized(page);await page.getByRole('link',{name:'查看输入快照',exact:true}).click();await authorized(page);await expect(page.getByRole('heading',{name:/快照/}).first()).toBeVisible();
  28 |  await page.goto(path);await authorized(page);await page.getByRole('link',{name:'查看研究审计',exact:true}).click();await authorized(page);await expect(page.getByRole('heading',{name:'Audit Explorer',exact:true})).toBeVisible();
  29 |  expect(networkRows().filter(r=>r.method==='POST'&&r.path==='/v1/research-runs')).toHaveLength(1);
  30 |  expect(networkRows().some(r=>/commands|deployment|orders/.test(r.path))).toBe(false);
  31 |  await writeFile(info.outputPath('worker-result.json'),JSON.stringify(result,null,2));await page.screenshot({path:info.outputPath('audit.png'),fullPage:true});
  32 | });
  33 | test('U01 queued cancellation reaches runtime cancellation without publishing output and recovery never repeats writes',async({page},info)=>{
  34 |  const path=await create(page);await page.getByRole('button',{name:'请求取消研究',exact:true}).click();await page.getByRole('button',{name:'确认请求取消',exact:true}).click();
  35 |  await expect(page.getByRole('region',{name:'取消受理回执',exact:true})).toBeVisible();await expect(page.getByTestId('research-status')).toContainText('cancelled');
  36 |  const result=await executeWorker();expect(result.results[0]).toMatchObject({bffRunId:path.split('/').at(-1),status:'cancelled',artifactPublished:false});
  37 |  const count=networkRows().filter(r=>r.method==='POST').length;await page.evaluate(()=>dispatchEvent(new Event('offline')));await expect(page.getByTestId('research-status')).toHaveCount(0);
  38 |  await page.getByRole('button',{name:'重新验证访问条件',exact:true}).click();await authorized(page);await expect(page.getByTestId('research-status')).toContainText('cancelled');expect(networkRows().filter(r=>r.method==='POST')).toHaveLength(count);
  39 |  await writeFile(info.outputPath('worker-cancel.json'),JSON.stringify(result,null,2));
  40 | });
  41 | test('U01 small screen hides create cancel retry and closes an open confirmation on resize',async({page})=>{
  42 |  const path=await create(page);await page.getByRole('button',{name:'请求取消研究',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  43 |  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'请求取消研究',exact:true})).toHaveCount(0);
  44 |  await page.goto('/research/new');await authorized(page);await expect(page.getByRole('button',{name:'提交研究',exact:true})).toHaveCount(0);await expect(page.getByText(/当前屏幕或身份不允许新建研究/)).toBeVisible();
  45 |  await page.goto('/research');await authorized(page);await expect(page.getByRole('link',{name:'新建研究',exact:true})).toHaveCount(0);
  46 |  for(const route of ['/login','/command','/research','/research/new','/data-snapshots',path]){await page.goto(route);await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);}
  47 | });
  48 | test('U01 server rejects insufficient identity and invalid snapshot; explicit recovery keeps original run',async({page})=>{
  49 |  const path=await create(page);fault({readonly:true});await page.reload();await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.getByTestId('research-status')).toHaveCount(0);
  50 |  expect((await control(path.replace('/research/','/v1/research-runs/'),undefined,undefined,{session:'session-approver'})).status).toBe(403);
  51 |  fault({});await page.getByRole('button',{name:'重新验证访问条件',exact:true}).click();await authorized(page);await expect(page.getByTestId('research-status')).toContainText('queued');
  52 |  const invalid=await control('/v1/research-runs',{capability:'research.hypothesis.v1',dataSnapshotId:'11111111-1111-4111-8111-000000000002',question:'Rejected quality',budget:'250',deadlineAt:new Date(Date.now()+3600000).toISOString()},undefined,{method:'POST'});expect(invalid.status).toBe(422);
  53 |  expect(networkRows().filter(r=>r.method==='POST'&&r.path==='/v1/research-runs'&&r.status===202)).toHaveLength(1);
  54 | });
  55 | test('U01 actual BFF MFA rejection and verification return to the authorized Research shell',async({page})=>{
  56 |  await page.goto('/mfa?return_to=/research');
  57 |  for(const [i,digit] of [...'000000'].entries())await page.getByLabel(`验证码第 ${i+1} 位`).fill(digit);
  58 |  await page.getByRole('button',{name:'验证并继续',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
> 59 |  expect(networkRows().some(r=>r.path==='/v1/auth/mfa/challenges'&&r.status===200&&r.mfaStatus==='failed')).toBe(true);
     |                                                                                                            ^ Error: expect(received).toBe(expected) // Object.is equality
  60 |  for(const [i,digit] of [...'123456'].entries())await page.getByLabel(`验证码第 ${i+1} 位`).fill(digit);
  61 |  await page.getByRole('button',{name:'验证并继续',exact:true}).click();await page.waitForURL('**/research');await authorized(page);
  62 |  expect(networkRows().some(r=>r.path==='/v1/auth/mfa/challenges'&&r.status===200&&r.mfaStatus==='verified')).toBe(true);
  63 |  await page.goto('/command');await authorized(page);await expect(page.getByRole('navigation').first()).toBeVisible();
  64 | });
  65 | 
```