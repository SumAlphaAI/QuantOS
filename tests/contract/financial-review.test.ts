// Actual owned process response shapes; not a replacement for current execution.
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {validateFixture} from './validate.mjs';
const p=JSON.parse(readFileSync('docs/audit/evidence/core-x06-financial-review-local-20261030/preflight/accepted-03.json','utf8'));
for(const [schema,v]of[['FinancialReviewView',p.reviewed],['FinancialReviewReceipt',p.request],['FinancialReviewReceipt',p.endorsement],['FinancialReviewReceipt',p.permit],['FinancialReviewAdmission',p.reviewed.riskBooks.financialReview],['NativeRiskReviewView',p.risk],['AssistedRequestView',p.original]]as const)it('accepts owner process '+schema,()=>expect(validateFixture(v,{schema})).toEqual([]));
for(const [field,value]of[['coveredObligations',0],['recordHash','unbound'],['killGeneration',0],['executionAuthority',true]]as const)it('rejects invalid admission '+field,()=>expect(validateFixture({...p.reviewed.riskBooks.financialReview,[field]:value},{schema:'FinancialReviewAdmission'}).length).toBeGreaterThan(0));
for(const [field,value]of[['sourceStatus','CLOSED'],['executionAuthority',true],['action','auto_close'],['role','viewer']]as const)it('rejects event authority promotion '+field,()=>expect(validateFixture({...p.permit.event,[field]:value},{schema:'FinancialReviewEvent'}).length).toBeGreaterThan(0));
it('request cannot inject financial values or source obligations',()=>expect(validateFixture({expectedRevision:'0',contextHash:p.reviewed.contextHash,reason:'review',confirmPhrase:'REQUEST FINANCIAL REVIEW',mfaChallengeRef:'challenge',reauthTokenRef:'grant',openObligations:0},{schema:'FinancialReviewRequest'}).length).toBeGreaterThan(0));
