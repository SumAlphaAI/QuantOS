// Actual owned process response shapes; not a replacement for current execution.
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {validateFixture} from './validate.mjs';
const p=JSON.parse(readFileSync('docs/audit/evidence/core-x06-source-review-local-20261030/preflight/accepted-02.json','utf8'));
for(const [schema,v]of[['SourceReviewView',p.reviewed],['SourceReviewReceipt',p.request],['SourceReviewReceipt',p.endorsement],['SourceReviewReceipt',p.permit],['SourceReviewAdmission',p.reviewed.riskBooks.sourceReview],['NativeRiskReviewView',p.risk],['AssistedRequestView',p.original]]as const)it('accepts owner process '+schema,()=>expect(validateFixture(v,{schema})).toEqual([]));
for(const [field,value]of[['coveredObligations',0],['recordHash','unbound'],['killGeneration',0],['executionAuthority',true]]as const)it('rejects invalid admission '+field,()=>expect(validateFixture({...p.reviewed.riskBooks.sourceReview,[field]:value},{schema:'SourceReviewAdmission'}).length).toBeGreaterThan(0));
for(const [field,value]of[['sourceStatus','CLOSED'],['executionAuthority',true],['action','auto_close'],['role','viewer']]as const)it('rejects event authority promotion '+field,()=>expect(validateFixture({...p.permit.event,[field]:value},{schema:'SourceReviewEvent'}).length).toBeGreaterThan(0));
it('request cannot inject financial values or source obligations',()=>expect(validateFixture({expectedRevision:'0',contextHash:p.reviewed.contextHash,reason:'review',confirmPhrase:'REQUEST SOURCE HEALTH REVIEW',mfaChallengeRef:'challenge',reauthTokenRef:'grant',openObligations:0},{schema:'SourceReviewRequest'}).length).toBeGreaterThan(0));
