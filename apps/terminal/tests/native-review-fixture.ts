// Explicit UI response model. Not signatures/native/market/IdP acceptance.
import {readFileSync} from 'node:fs';
import type {BffComponents} from '@sumalpha/api-client';
import {assistedModel} from './core-l03-fixture';
type S=BffComponents['schemas'];
export function nativeReviewModel(eligible=false,role:'operator'|'approver'='operator'){
 const m=assistedModel(role),raw=JSON.parse(readFileSync('docs/audit/evidence/core-x02-native-review-local-20261029/attempt-01/review.json','utf8'));
 const v=structuredClone(raw.valuation);Object.assign(v,{tenantId:m.context.tenantId,workspaceId:m.context.workspaceId,accountId:m.context.accountId});Object.assign(v.snapshot.scope,{tenantId:m.context.tenantId,workspaceId:m.context.workspaceId,accountId:m.context.accountId});
 const at=Date.parse('2026-10-27T00:00:00Z');v.checkedAt=new Date(at).toISOString();v.expiresAt=new Date(at+8000).toISOString();v.snapshot.generatedAt=v.checkedAt;v.snapshot.expiresAt=new Date(at+30000).toISOString();
 const candidate:S['NativeRiskCandidate']={subjectId:m.subject.subjectId,proposalId:'ui-model:immutable-proposal',proposalHash:m.subject.proposalHash,proposalExpiresAt:new Date(at+60000).toISOString(),accountId:m.context.accountId,symbol:m.subject.symbol,side:m.subject.side,quantity:m.subject.quantity,limitPrice:m.subject.limitPrice,executionAuthority:false};
 const binding={snapshotHash:v.snapshot.snapshotHash,ledgerHash:v.ledgerHash,sourceHash:v.sourceHash,sourceVersion:v.sourceVersion,killGeneration:v.killGeneration,expiresAt:v.snapshot.expiresAt,executionAuthority:false as const};
 const review=structuredClone(raw.review);Object.assign(review,{previousSubjectId:candidate.subjectId,proposalId:candidate.proposalId,proposalHash:candidate.proposalHash,snapshotHash:binding.snapshotHash,ledgerHash:binding.ledgerHash,sourceHash:binding.sourceHash,sourceVersion:binding.sourceVersion,killGeneration:binding.killGeneration});Object.assign(review.decision,{proposalHash:candidate.proposalHash,snapshotHash:binding.snapshotHash,killGeneration:binding.killGeneration,decidedAt:v.checkedAt,expiresAt:v.snapshot.expiresAt});
 if(eligible){review.decision.verdict='approval_required';review.subject={...m.subject,subjectId:'00000000-0000-4000-8000-000000000099',subjectHash:'sha256:'+'d'.repeat(64),decisionId:review.decision.decisionId,expiresAt:v.snapshot.expiresAt,nativeRiskBinding:binding};}
 m.setNativeReview({valuation:v,review,candidates:[candidate]});return{...m,candidate,valuation:v,review};
}
