import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boundary,validateBoundary,validateMatrices,safeArtifact,checks} from './core-l01-review.mjs';
const corpus=JSON.parse(readFileSync('crates/quantos-execution/tests/fixtures/l01-corpus.json')).cases;
const matrix=()=>{
 const common={actualTestnetConnected:false,productionCredentialsUsed:false};
 const cases=corpus.map(c=>({id:c.id,kind:c.kind,status:c.expectedStatus,fills:['filled','partial'].includes(c.kind)?1:0}));
 return[{...common,schema:'quantos-l01-mapping/v1',scope:'OWNED_PROTOCOL_NOT_EXCHANGE_TESTNET',cases:cases.map(c=>({...c,requests:['cancelled','cancel_rejected'].includes(c.kind)?2:1}))},{...common,schema:'quantos-l01-owned-process/v1',transport:'ACTUAL_OWNED_STDIO_NOT_EXCHANGE_HTTP',credentialsInherited:false,wireRequests:250,cases:cases.map(c=>({...c,duplicateWrites:0,anchor:{count:3,head:'sha256:'+'a'.repeat(64)}}))}];
};
test('L01 engineering scope preserves unexecuted environment and formal obligations',()=>validateBoundary(boundary()));
for(const key of Object.keys(boundary()))test('L01 rejects boundary promotion '+key,()=>{const b=boundary();b[key]=typeof b[key]==='boolean'?!b[key]:'READY';assert.throws(()=>validateBoundary(b));});
test('L01 corpus has exactly 200 unique cases and two explicitly owned replay surfaces',()=>validateMatrices(...matrix()));
for(const key of ['missing','duplicate','status','fills','requests','duplicateWrites','head','wireRequests','actualTestnet','credentials','transport'])test('L01 rejects mapping evidence drift '+key,()=>{
 const [d,p]=matrix();switch(key){
 case 'missing':d.cases.pop();break;
 case 'duplicate':p.cases[1].id=p.cases[0].id;break;
 case 'status':p.cases[0].status='accepted';break;
 case 'fills':d.cases[0].fills=0;break;
 case 'requests':d.cases[0].requests=2;break;
 case 'duplicateWrites':p.cases[0].duplicateWrites=1;break;
 case 'head':p.cases[0].anchor.head='unbound';break;
 case 'wireRequests':p.wireRequests=200;break;
 case 'actualTestnet':d.actualTestnetConnected=true;break;
 case 'credentials':p.credentialsInherited=true;break;
 default:p.transport='EXCHANGE_HTTP';
 }assert.throws(()=>validateMatrices(d,p));
});
test('L01 artifact scanner accepts public references but rejects production origin and credential shapes',()=>{
 safeArtifact('https://testnet.binance.vision secret://quantos/venues/binance-testnet-key');
 for(const value of ['https://api.binance.com','https://api1.binance.com','X-MBX-APIKEY: owned-canary','-----BEGIN PRIVATE KEY-----','apiSecret=owned-canary'])assert.throws(()=>safeArtifact(value));
});
test('L01 commands stay in current function and direct consumer regression scope',()=>{
 assert(!checks.some(([,args])=>args.includes('--workspace')||args.includes('--integration')&&!args.includes('CORE:L01')));
 assert(checks.some(([id,args,exit])=>id==='integration-refusal'&&exit===1&&args.includes('CORE:L01')));
 assert(checks.some(([id,args])=>id==='evidence-compile-only'&&args.includes('--no-run')));
 assert(!checks.some(([,args])=>args.some(arg=>/f05|f07|docker|supabase|--release/.test(arg))));
});
