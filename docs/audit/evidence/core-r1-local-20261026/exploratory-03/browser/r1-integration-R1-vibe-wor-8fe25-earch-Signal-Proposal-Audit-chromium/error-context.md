# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: r1-integration.spec.ts >> R1 vibe workflow_briefing_equities_01 actual research Signal Proposal Audit
- Location: tests/e2e/r1-integration.spec.ts:21:37

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "sha256:e236917758063febef23e04be2268866d70f1e9c5d1ada6f5c5352b6f78a4ac9"
Received: "sha256:7e578fda4dd9b048689a12509f176b8edb1b063a179467a513d90960b554539f"
```

# Test source

```ts
  1  | import {test,expect,type Page,type TestInfo} from "@playwright/test";
  2  | import {readFileSync,writeFileSync} from "node:fs";
  3  | import {createHash} from "node:crypto";
  4  | import {authorized,control,executeWorker,installReferenceHooks,networkRows,snapshotId} from "./fixtures/u01-reference";
  5  | const workflows=(JSON.parse(readFileSync('engines/vibe-adapter/src/vibe_adapter/fixtures/catalog.json','utf8')).fixtures as {fixture_name:string}[]).map(f=>f.fixture_name);
  6  | installReferenceHooks({r1:true,workflowForTest:title=>title.includes('vibe')?(workflows.find(name=>title.includes(name))??workflows[0]):undefined,recoverForTest:title=>title.includes('recover')});
  7  | const hash=(value:unknown)=>'sha256:'+createHash('sha256').update(JSON.stringify(value)).digest('hex');
  8  | async function run(page:Page,info:TestInfo){
  9  |  await page.goto('/research/new');await authorized(page);await page.getByLabel('研究问题',{exact:true}).fill('R1 research signal proposal reference');await page.getByLabel('数据快照',{exact:true}).selectOption(snapshotId());await page.getByLabel('预算（整数成本单位）',{exact:true}).fill('250');await page.getByRole('checkbox',{name:'我已确认任务不包含交易指令',exact:true}).check();await page.getByRole('button',{name:'提交研究',exact:true}).click();const link=page.getByRole('link',{name:'查看研究详情',exact:true});await expect(link).toBeVisible();const path=(await link.getAttribute('href'))!;await link.click();await authorized(page);await expect(page.getByTestId('research-sequence')).toHaveText('1');
  10 |  const result=await executeWorker();expect(result.results).toHaveLength(1);const row=result.results[0],chain=row.chain;expect(chain.run.status).toBe('succeeded');expect(chain.rejectedReferences).toBe(22);expect(chain.sameKeyReplayPreserved).toBe(true);expect(chain.checkpointAfterReplay.checkpoint_key).toBe('signal_proposal.completed');expect(chain.repository).toEqual({signals:1,proposals:1});expect(chain.proposal.executable).toBe(false);expect(chain.proposal.output.executable).toBe(false);expect(chain.proposal.counter_views.length).toBeGreaterThan(0);expect(chain.openbb).toBe('NOT_REGISTERED');expect(chain.orderCapability).toBe('NOT_REGISTERED');
  11 |  const lineage=chain.signal.output.diagnostics.value.research_context;expect(lineage.source.content_hash).toBe(row.record.artifact_manifest.content_hash);expect(lineage.source.workflow_run_id).toBe(row.record.workflow_run_id);expect(chain.proposal.output.signal.diagnostics.value.research_context).toEqual(lineage);expect(Date.parse(chain.signal.output.generated_at)).toBe(Date.parse(chain.run.created_at));expect(chain.signal.stream_events.at(-1).done).toBe(true);expect(chain.proposal.stream_events.at(-1).done).toBe(true);
  12 |  if(info.title.includes('recover')){expect(chain.recovery.failure).toBe('PROPOSAL_ROUTE_NOT_REGISTERED');expect(chain.recovery.checkpoint.checkpoint_key).toBe('signal_proposal.signal_ready');expect(chain.recovery.checkpoint.payload.signal_input).toBeTruthy();expect(chain.run.attempts).toBe(2);}else expect(chain.recovery).toBeNull();
  13 |  await expect(page.getByTestId('research-status')).toContainText('succeeded');await page.getByRole('link',{name:row.record.artifact_manifest.artifact_id,exact:true}).click();await authorized(page);await expect(page.getByRole('region',{name:'Artifact 元数据',exact:true})).toContainText(row.record.output.summary);
  14 |  await page.goto(path);await authorized(page);await page.getByRole('link',{name:'查看研究审计',exact:true}).click();await authorized(page);await expect(page.getByRole('heading',{name:'Audit Explorer',exact:true})).toBeVisible();await expect(page.getByText('当前授权范围内链完整',{exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'因果证据链',exact:true})).toContainText('signal.generated');await expect(page.getByRole('region',{name:'因果证据链',exact:true})).toContainText('proposal.generated');
  15 |  const events=(await control(`/v1/audit/events?correlationId=${row.record.output.audit.correlation_id}&pageSize=100`)).body;
  16 |  const audit=(await control(`/v1/audit/evidence-chains/${row.record.output.audit.correlation_id}?pageSize=100`)).body;expect(audit.complete).toBe(true);for(let i=1;i<audit.items.length;i++)expect(audit.items[i].causationId).toBe(audit.items[i-1].eventId);
> 17 |  for(const [record,kind]of [[row.record,'research.artifact.registered'],[chain.signal,'signal.generated'],[chain.proposal,'proposal.generated']]as const){const event=events.items.find((e:{objectRef:string;kind:string})=>e.objectRef===record.artifact_manifest.artifact_id&&e.kind===kind);expect(event).toBeTruthy();expect(event.redactedPayload.scopeHash).toBe(hash(record));}
     |                                                                                                                                                                                                                                                                                                                                                                   ^ Error: expect(received).toBe(expected) // Object.is equality
  18 |  const ids=[row.record.artifact_manifest.artifact_id,chain.signal.artifact_manifest.artifact_id,chain.proposal.artifact_manifest.artifact_id,snapshotId(),...chain.signal.auxiliary_artifact_manifests.map((m:{artifact_id:string})=>m.artifact_id),...chain.proposal.auxiliary_artifact_manifests.map((m:{artifact_id:string})=>m.artifact_id)];expect(ids.every(id=>audit.items.some((e:{objectRef:string})=>e.objectRef===id))).toBe(true);
  19 |  expect(networkRows().some(r=>/commands|deployment|orders/.test(r.path))).toBe(false);expect(networkRows().filter(r=>r.method==='POST'&&r.path==='/v1/research-runs')).toHaveLength(1);writeFileSync(info.outputPath('r1-chain.json'),JSON.stringify({path,result,audit,events},null,2));
  20 | }
  21 | for(const workflow of workflows)test(`R1 vibe ${workflow} actual research Signal Proposal Audit`,async({page},info)=>run(page,info));
  22 | test('R1 RD actual research Signal Proposal Audit',async({page},info)=>run(page,info));
  23 | test('R1 RD recover after Signal checkpoint and missing Proposal route',async({page},info)=>run(page,info));
  24 | test('R1 vibe recover workflow_briefing_equities_01 after Signal checkpoint',async({page},info)=>run(page,info));
  25 | 
```