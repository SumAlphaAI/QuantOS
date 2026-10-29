// Wire shape fixtures only. Current business proof is the named native process run.
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {validateFixture} from './validate.mjs';
import {bffZodSchemas} from '../../packages/api-client/src/bff-gen/quantos-bff.zod';
const p=JSON.parse(readFileSync('docs/audit/evidence/core-x02-native-review-local-20261029/preflight/review.json','utf8'));
const copy=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
const body={snapshotHash:p.review.snapshotHash,expectedGeneration:p.review.killGeneration};
it('current explicit request accepts only a hash and generation',()=>expect(validateFixture(body,{schema:'NativeRiskReviewRequest'})).toEqual([]));
for(const [name,b]of [['cash',{...body,equity:'999999'}],['mark',{...body,mark:'1000'}],['numeric generation',{...body,expectedGeneration:0}],['missing hash',{expectedGeneration:'0'}],['invalid hash',{...body,snapshotHash:'owned'}]])it('request refuses '+name,()=>expect(validateFixture(b,{schema:'NativeRiskReviewRequest'}).length).toBeGreaterThan(0));
it('actual signed Deny projection fits the public schema',()=>expect(validateFixture(p.review,{schema:'NativeRiskReviewView'})).toEqual([]));
it('generated SDK schema accepts the actual projection',()=>expect(bffZodSchemas.NativeRiskReviewView.safeParse(p.review).success).toBe(true));
const approval=copy(p.review);approval.decision.verdict='approval_required';approval.subject=copy(p.originalSubject);approval.subject.decisionId=approval.decision.decisionId;
it('eligible review wire model requires a separate subject',()=>expect(validateFixture(approval,{schema:'NativeRiskReviewView'})).toEqual([]));
for(const[name,edit]of [
 ['Deny carries subject',(v:typeof p.review)=>{v.subject=approval.subject;}],
 ['unsigned execution Allow',(v:typeof p.review)=>{v.decision.verdict='allow';}],
 ['approval missing subject',(v:typeof p.review)=>{v.decision.verdict='approval_required';}],
 ['execution authority',(v:typeof p.review)=>{v.executionAuthority=true;}],
 ['decision authority',(v:typeof p.review)=>{v.decision.executionAuthority=true;}],
 ['signature',(v:typeof p.review)=>{v.decision.signature='unchecked';}],
 ['missing rule',(v:typeof p.review)=>{v.decision.checks.pop();}],
 ['numeric generation',(v:typeof p.review)=>{v.killGeneration=0;}],
 ['foreign source trust',(v:typeof p.review)=>{v.sourceTrust='REAL_MARKET';}],
 ['browser financials',(v:typeof p.review)=>{v.equity='999999';}],
 ['source version',(v:typeof p.review)=>{v.sourceVersion='0';}],
]as const)it('review refuses '+name,()=>{const v=copy(p.review);edit(v);expect(validateFixture(v,{schema:'NativeRiskReviewView'}).length).toBeGreaterThan(0);});
