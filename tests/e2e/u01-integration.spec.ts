import {test,expect,type Page} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {authorized,control,executeWorker,fault,installReferenceHooks,networkRows,snapshotId} from "./fixtures/u01-reference";
installReferenceHooks();
async function create(page:Page){
 await page.goto('/research/new');await authorized(page);
 await page.getByLabel('研究问题',{exact:true}).fill('Validate bounded BTC momentum with owned U01 input');
 await page.getByLabel('数据快照',{exact:true}).selectOption(snapshotId());
 await page.getByLabel('预算（整数成本单位）',{exact:true}).fill('250');
 await page.getByRole('checkbox',{name:'我已确认任务不包含交易指令',exact:true}).check();
 await page.getByRole('button',{name:'提交研究',exact:true}).click();
 await expect(page.getByRole('region',{name:'研究受理回执',exact:true})).toBeVisible();
 const link=page.getByRole('link',{name:'查看研究详情',exact:true}),path=(await link.getAttribute('href'))!;
 await link.click();await authorized(page);await expect(page.getByTestId('research-status')).toContainText('queued');
 return path;
}
test('U01 Web create streams actual R03 RD-Agent output and resolves Artifact Evidence Snapshot Audit',async({page},info)=>{
 const path=await create(page);await expect(page.getByTestId('research-sequence')).toHaveText('1');
 const result=await executeWorker();expect(result.results).toHaveLength(1);
 const record=result.results[0].record;expect(result.results[0].bffRunId).toBe(path.split('/').at(-1));expect(record.output.artifact_type).toBe('ResearchArtifact');expect(record.stream_events.length).toBeGreaterThan(0);
 await expect(page.getByTestId('research-status')).toContainText('succeeded');await expect.poll(async()=>Number(await page.getByTestId('research-sequence').textContent())).toBeGreaterThanOrEqual(2);
 const fact=(await control(path.replace('/research/','/v1/research-runs/'))).body;expect(fact.artifactRefs).toContain(record.artifact_manifest.artifact_id);expect(fact.evidenceRefs.length).toBeGreaterThan(0);
 const attachment=(await control(`/v1/artifacts/${record.artifact_manifest.artifact_id}/attachment`)).body;expect(attachment.content).toEqual(record.output);expect(attachment.contentHash).toBe(record.artifact_manifest.content_hash);
 const chain=(await control(`/v1/audit/evidence-chains/${fact.correlationId}`)).body;expect(chain.items.some((e:{kind:string})=>e.kind==='research.worker.completed')).toBe(true);
 await page.getByRole('link',{name:record.artifact_manifest.artifact_id,exact:true}).click();await authorized(page);await expect(page.getByRole('region',{name:'Artifact 元数据',exact:true})).toContainText('r03-worker-owned-uds');
 await page.goto(path);await authorized(page);await page.getByRole('link',{name:fact.evidenceRefs[0],exact:true}).click();await authorized(page);await expect(page.getByRole('region',{name:'Artifact 元数据',exact:true})).toBeVisible();
 await page.goto(path);await authorized(page);await page.getByRole('link',{name:'查看输入快照',exact:true}).click();await authorized(page);await expect(page.getByRole('heading',{name:/快照/}).first()).toBeVisible();
 await page.goto(path);await authorized(page);await page.getByRole('link',{name:'查看研究审计',exact:true}).click();await authorized(page);await expect(page.getByRole('heading',{name:'Audit Explorer',exact:true})).toBeVisible();
 expect(networkRows().filter(r=>r.method==='POST'&&r.path==='/v1/research-runs')).toHaveLength(1);
 expect(networkRows().some(r=>/commands|deployment|orders/.test(r.path))).toBe(false);
 await writeFile(info.outputPath('worker-result.json'),JSON.stringify(result,null,2));await page.screenshot({path:info.outputPath('audit.png'),fullPage:true});
});
test('U01 queued cancellation reaches runtime cancellation without publishing output and recovery never repeats writes',async({page},info)=>{
 const path=await create(page);await page.getByRole('button',{name:'请求取消研究',exact:true}).click();await page.getByRole('button',{name:'确认请求取消',exact:true}).click();
 await expect(page.getByRole('region',{name:'取消受理回执',exact:true})).toBeVisible();await expect(page.getByTestId('research-status')).toContainText('cancelled');
 const result=await executeWorker();expect(result.results[0]).toMatchObject({bffRunId:path.split('/').at(-1),status:'cancelled',artifactPublished:false});
 const count=networkRows().filter(r=>r.method==='POST').length;await page.evaluate(()=>dispatchEvent(new Event('offline')));await expect(page.getByTestId('research-status')).toHaveCount(0);
 await page.getByRole('button',{name:'重新验证访问条件',exact:true}).click();await authorized(page);await expect(page.getByTestId('research-status')).toContainText('cancelled');expect(networkRows().filter(r=>r.method==='POST')).toHaveLength(count);
 await writeFile(info.outputPath('worker-cancel.json'),JSON.stringify(result,null,2));
});
test('U01 small screen hides create cancel retry and closes an open confirmation on resize',async({page})=>{
 const path=await create(page);await page.getByRole('button',{name:'请求取消研究',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'请求取消研究',exact:true})).toHaveCount(0);
 await page.goto('/research/new');await authorized(page);await expect(page.getByRole('button',{name:'提交研究',exact:true})).toHaveCount(0);await expect(page.getByText(/当前屏幕或身份不允许新建研究/)).toBeVisible();
 await page.goto('/research');await authorized(page);await expect(page.getByRole('link',{name:'新建研究',exact:true})).toHaveCount(0);
 for(const route of ['/login','/command','/research','/research/new','/data-snapshots',path]){await page.goto(route);await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);}
});
test('U01 server rejects insufficient identity and invalid snapshot; explicit recovery keeps original run',async({page})=>{
 const path=await create(page);fault({readonly:true});await page.reload();await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.getByTestId('research-status')).toHaveCount(0);
 expect((await control(path.replace('/research/','/v1/research-runs/'),undefined,undefined,{session:'session-approver'})).status).toBe(403);
 fault({});await page.getByRole('button',{name:'重新验证访问条件',exact:true}).click();await authorized(page);await expect(page.getByTestId('research-status')).toContainText('queued');
 const invalid=await control('/v1/research-runs',{capability:'research.hypothesis.v1',dataSnapshotId:'11111111-1111-4111-8111-000000000002',question:'Rejected quality',budget:'250',deadlineAt:new Date(Date.now()+3600000).toISOString()},undefined,{method:'POST'});expect(invalid.status).toBe(422);
 expect(networkRows().filter(r=>r.method==='POST'&&r.path==='/v1/research-runs'&&r.status===202)).toHaveLength(1);
});
test('U01 actual BFF MFA rejection and verification return to the authorized Research shell',async({page})=>{
 await page.goto('/mfa?return_to=/research');
 for(const [i,digit] of [...'000000'].entries())await page.getByLabel(`验证码第 ${i+1} 位`).fill(digit);
 await page.getByRole('button',{name:'验证并继续',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
 await expect.poll(()=>networkRows().some(r=>r.path==='/v1/auth/mfa/challenges'&&r.status===200&&r.mfaStatus==='failed')).toBe(true);
 await expect(page.getByRole('button',{name:'验证并继续',exact:true})).toBeEnabled();
 for(const [i,digit] of [...'123456'].entries())await page.getByLabel(`验证码第 ${i+1} 位`).fill(digit);
 await page.getByRole('button',{name:'验证并继续',exact:true}).click();await page.waitForURL('**/research');await authorized(page);
 await expect.poll(()=>networkRows().some(r=>r.path==='/v1/auth/mfa/challenges'&&r.status===200&&r.mfaStatus==='verified')).toBe(true);
 await page.goto('/command');await authorized(page);await expect(page.getByRole('navigation').first()).toBeVisible();
});
