import {test,expect,type Page} from "@playwright/test";
import {readFileSync,writeFileSync} from "node:fs";
import {authorized,control,executeWorker,installReferenceHooks,networkRows,snapshotId} from "./fixtures/u01-reference";
const workflows=(JSON.parse(readFileSync('engines/vibe-adapter/src/vibe_adapter/fixtures/catalog.json','utf8')).fixtures as {fixture_name:string}[]).map(f=>f.fixture_name);
installReferenceHooks({workflowForTest:title=>workflows.find(name=>title.includes(name))??workflows[0]});
async function create(page:Page){
 await page.goto('/research/new');await authorized(page);
 await page.getByLabel('研究问题',{exact:true}).fill('CORE TP01 bounded workflow reference');
 await page.getByLabel('数据快照',{exact:true}).selectOption(snapshotId());
 await page.getByLabel('预算（整数成本单位）',{exact:true}).fill('250');
 await page.getByRole('checkbox',{name:'我已确认任务不包含交易指令',exact:true}).check();
 await page.getByRole('button',{name:'提交研究',exact:true}).click();
 const link=page.getByRole('link',{name:'查看研究详情',exact:true});await expect(link).toBeVisible();const path=(await link.getAttribute('href'))!;
 await link.click();await authorized(page);await expect(page.getByTestId('research-status')).toContainText('queued');await expect(page.getByTestId('research-sequence')).toHaveText('1');return path;
}
for(const workflow of workflows)test(`TP01 actual workflow ${workflow} reaches R03 Artifact Evidence Audit and Web`,async({page},info)=>{
 const path=await create(page),result=await executeWorker();expect(result.results).toHaveLength(1);const {record,input,bffRunId}=result.results[0];
 expect(bffRunId).toBe(path.split('/').at(-1));expect(input.question).toBe('CORE TP01 bounded workflow reference');
 expect(record.capability).toBe('research.vibe_adapter.execute');expect(record.output.engine).toBe('vibe-adapter');expect(record.output.fixture).toBe(workflow);expect(record.output.artifact_type).toBe('ResearchArtifact');expect(record.output.trade_executable).toBe(false);expect(record.output.environment.tools_executed).toBe(false);expect(record.output.tool_allowlist).toEqual([]);expect(record.output.audit.workflow_run_id).toBe(record.workflow_run_id);
 expect(record.stream_events.map((e:{delta:{phase:string}})=>e.delta.phase)).toEqual(['context_translated','workflow_planned','artifact_recorded']);expect(record.stream_events.at(-1).done).toBe(true);
 await expect(page.getByTestId('research-status')).toContainText('succeeded');
 const fact=(await control(path.replace('/research/','/v1/research-runs/'))).body;expect(fact.artifactRefs).toEqual([record.artifact_manifest.artifact_id]);expect(fact.evidenceRefs.length).toBeGreaterThan(0);
 const attachment=(await control(`/v1/artifacts/${record.artifact_manifest.artifact_id}/attachment`)).body;expect(attachment.content).toEqual(record.output);expect(attachment.contentHash).toBe(record.artifact_manifest.content_hash);
 const chain=(await control(`/v1/audit/evidence-chains/${fact.correlationId}`)).body;expect(chain.items.some((e:{kind:string})=>e.kind==='research.worker.completed')).toBe(true);
 await page.getByRole('link',{name:record.artifact_manifest.artifact_id,exact:true}).click();await authorized(page);await expect(page.getByRole('region',{name:'Artifact 元数据',exact:true})).toContainText(record.output.summary);
 await page.goto(path);await authorized(page);await page.getByRole('link',{name:fact.evidenceRefs[0],exact:true}).click();await authorized(page);await expect(page.getByRole('region',{name:'Artifact 元数据',exact:true})).toBeVisible();
 expect(networkRows().some(r=>/commands|deployment|orders/.test(r.path))).toBe(false);expect(networkRows().filter(r=>r.method==='POST'&&r.path==='/v1/research-runs'&&r.status===202)).toHaveLength(1);
 writeFileSync(info.outputPath('tp01-worker.json'),JSON.stringify({workflow,path,result},null,2));
});
test('TP01 queued cancellation reaches actual R03 without publishing adapter artifacts',async({page},info)=>{
 const path=await create(page);await page.getByRole('button',{name:'请求取消研究',exact:true}).click();await page.getByRole('button',{name:'确认请求取消',exact:true}).click();await expect(page.getByTestId('research-status')).toContainText('cancelled');const result=await executeWorker();expect(result.results[0]).toMatchObject({bffRunId:path.split('/').at(-1),status:'cancelled',artifactPublished:false});writeFileSync(info.outputPath('tp01-cancel.json'),JSON.stringify(result,null,2));
});
