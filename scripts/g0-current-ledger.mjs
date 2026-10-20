import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {digest} from './provider-a1-receipts.mjs';
export const mapping={'G0-L01-1':['C05'],'G0-L02-1':['C02'],'G0-L03-1':['C12'],'G0-L03-2':['C14'],'G0-L04-2':['C13'],'G0-L04-3':['C15'],'G0-L05-1':['C11'],'G0-L05-2':['C16']};
export const fixturePaths=['terminal','strategy','execution','ops'].map(n=>'packages/api-client/src/'+n+'.ts');
export function validateLedger({read=p=>readFileSync(p),ledger=JSON.parse(read('docs/gate-records/G0-current-disposition.json')),original=JSON.parse(read('docs/audit/evidence/g0-local-20261020/preflight/original-G0-current-disposition.json')),api=JSON.parse(read('docs/audit/evidence/provider-all-local-20261020/manifest.json'))}={}){
 assert.equal(ledger.schema,'quantos-g0-current-disposition/v1');assert.equal(ledger.historicalWholeItemClosure,false);assert.equal(ledger.items.length,19);assert.deepEqual(ledger.items.map(i=>i.id),original.items.map(i=>i.id));const rows=[];
 for(const [n,item] of ledger.items.entries()){
  const before=original.items[n],contracts=mapping[item.id];
  if(!contracts){assert.deepEqual(item,before,'unaffected disposition altered '+item.id);continue;}
  for(const k of ['id','parentId','stage','owner','deadline','closure'])assert.deepEqual(item[k],before[k]);assert.equal(before.status,'PENDING');assert.equal(item.status,'IMPLEMENTED_ENGINEERING');assert(item.compatibilityStrategy?.trim());assert(!item.scope.includes('planned'));assert.equal(item.engineeringReview.sourceCommit,api.observedSourceCommit);assert.equal(item.engineeringReview.receiptCommit,'fce2931240415cd1f713fcdfdf12f40adc1ef916');assert.equal(item.engineeringReview.evidenceMode,'ORIGINAL_CONFIRMED_FUNCTION_SCOPE_NOT_REBOUND');assert.equal(item.engineeringReview.formalClosed,false);assert.deepEqual(item.engineeringReview.contracts,contracts);
  const operations=api.apiCoverage.filter(o=>contracts.includes(o.contract)).map(o=>o.operationId);assert(operations.length>0);assert.deepEqual(item.engineeringReview.operations,operations);assert(item.evidence.includes('docs/audit/evidence/provider-all-local-20261020/manifest.json'));rows.push({id:item.id,status:item.status,contracts,operations});
 }
 assert.equal(rows.length,8);
 const legacy=ledger.items.find(i=>i.id==='G0-L10-2');assert.equal(legacy.deadline.before,'PROVIDER:ALL');
 const remaining=fixturePaths.filter(p=>/export class InMemory\w+Backend/.test(read(p).toString()));assert.equal(remaining.length,4);assert.equal(legacy.status,'PENDING','legacy classes cannot be marked removed');
 return{schema:'quantos-g0-current-ledger-review/v1',status:'PASS',mapped:rows,unchangedItems:11,legacy:{id:legacy.id,status:legacy.status,deadline:legacy.deadline,remaining,complete:false},historicalWholeItemClosure:false,sourceLedgerSha256:digest(read('docs/gate-records/G0-current-disposition.json'))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(validateLedger(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
