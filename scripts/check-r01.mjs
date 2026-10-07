#!/usr/bin/env node
// Static assembly checks complement, never replace, the Rust behavior and Supabase Gates.
import {existsSync,readFileSync} from 'node:fs';
import process from 'node:process';
import console from 'node:console';
import {dirname,resolve} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const text=p=>readFileSync(resolve(root,p),'utf8');
function taskStatus(plan,id){return plan.match(new RegExp('- task_id: `'+id+'`([\\s\\S]*?)(?=\\n<a id=|$)'))?.[1].match(/- development_status: `([^`]+)`/)?.[1];}
function review(plan,id) {
 const parts=plan.split(`<a id="task-${id.toLowerCase()}"></a>`);
 if(parts.length!==2)return null;
 const summaries=[...parts[1].split('<a id=')[0].matchAll(/^- 当前工程复核：(\S.*)$/gm)];
 if(summaries.length!==1)return null;
 const statuses=[...summaries[0][1].matchAll(/历史正式复审：`([^`]+)`/g)];
 return statuses.length===1?statuses[0][1]:null;
}
export function loadR01Inputs(){return{plan:text('docs/SumAlpha-QuantOS-Development-Plan.md'),source:text('crates/quantos-market/src/lib.rs'),tests:text('crates/quantos-market/src/tests.rs'),durable:text('crates/quantos-market/src/durable.rs'),service:text('services/market-ingestor/src/main.rs')+text('services/market-ingestor/src/cli.rs'),fixture:JSON.parse(text('crates/quantos-market/fixtures/market_replay_catalog.json')),makefile:text('Makefile'),workflow:text('.github/workflows/ci.yml'),foundation:JSON.parse(text('docs/audit/evidence/f0-91e222f/index.json')),migration:text('supabase/migrations/20261002100000_r01_atomic_ingest_function.sql'),summaryExists:existsSync(resolve(root,'docs/R01-summary.md'))};}
export function validateR01(i){const failures=[];const check=(c,m)=>{if(!c)failures.push(m);};
 for(const id of ['F03','F05']){check(taskStatus(i.plan,id)==='COMPLETED',`dependency ${id} is COMPLETED`);check(review(i.plan,id)==='ACCEPTED',`dependency ${id} is ACCEPTED`);}
 check(i.plan.match(/"checkpoint_id": "CORE-GATE:F0"[\s\S]*?"review_status": "([^"]+)"/)?.[1]==='ACCEPTED'&&i.foundation.f0Gate==='ACCEPTED'&&i.plan.includes(i.foundation.sourceCommit),'F0 accepted receipt matches the plan');
 check(taskStatus(i.plan,'R01')==='COMPLETED','R01 development status is COMPLETED');
 check(i.fixture.count===100000,'replay fixture contains exactly 100000 ticks');check(i.fixture.duplicate_every>0&&i.fixture.out_of_order_every>1&&i.fixture.stale_every>0&&i.fixture.quality_fail_every>0,'replay fixture injects all quality scenarios');
 for(const m of ['ApprovedProviderRegistry','MARKET_SOURCE_CONFLICT','approval_reference','instruments','ingest_tick_at','ResourceLimit','staged_ledger'])check(i.source.includes(m),`market contract implements ${m}`);
 for(const m of ['identity_is_tenant_scoped_and_conflicting_content_is_rejected','failed_batch_does_not_publish_partial_ledger_or_identity','invalid_numeric_ticks_emit_quality_with_raw_values_and_continue','pure_domain_p95_under_fifty_milliseconds'])check(i.tests.includes(m),`behavior test ${m} exists`);
 check(i.durable.includes('append_market_events')&&i.durable.includes('watchdog'),'durable writer and watchdog are connected');
 check(i.migration.includes('on conflict(tenant_id,provider,source_tick_id)')&&i.migration.includes('for update')&&i.migration.includes('quantos.outbox_event'),'single-statement atomic source receipt and outbox');
 check(i.service.includes('IngestSource')&&i.service.includes('PollSource')&&i.service.includes('Requeue'),'persistent source and recovery commands exist');
 check(i.makefile.includes('r01-mutation-check')&&i.makefile.includes('cargo test -p quantos-market --lib --locked')&&i.makefile.includes('cargo test -p market-ingestor --locked'),'R01 Gate executes behavior and CLI tests');
 check(i.workflow.includes('make r01-check'),'main CI runs the R01 Gate');check(i.summaryExists,'R01 delivery summary exists');
 return{status:failures.length?'FAIL':'PASS',failures};}
if(import.meta.url===pathToFileURL(process.argv[1]).href){const r=validateR01(loadR01Inputs());if(r.failures.length){r.failures.forEach(m=>console.error(`FAIL ${m}`));process.exitCode=1;}else console.log('R01 assembly Gate PASS; runtime, coverage and target Gates are separate.');}
