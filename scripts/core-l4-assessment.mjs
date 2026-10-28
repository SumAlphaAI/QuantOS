// Current L4 assessment; historical hashes confer no current-stage readiness.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyInputs as verifyHistoricalInputs} from './g1-download-review.mjs';
import {nodesFromPlans,planInput} from './provider-a1-receipts.mjs';
export const base='457f20e752ce416cead225c10d7b9dfbce4444ee';
export const assessmentPath='docs/execution/core-l4-current-assessment.json';
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const digest=s=>s.replace(/^sha256:/,'');
export const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:128e6});
export const references=[
 ['CORE-GATE:L4-SERVICE','l4-service-local-20261027','quantos-l4-service-current/v1'],
 ['CORE:L03','core-l03-local-20261027','quantos-core-l03-development/v1'],
 ['CORE:L04','core-l04-local-20261028','quantos-core-l04-development/v1'],
 ['FRONTEND-GATE:G8','frontend-g8-current-20261027','quantos-g8-current-development/v1'],
 ['FE:FEP-8','fep8-current-local-20261027','quantos-fep8-current-review-receipt/v1']
];
export function safe(path){assert(typeof path==='string'&&!path.startsWith('/')&&!path.includes('\\')&&!path.includes('\0')&&!path.split('/').includes('..'));assert(!/(?:^|\/)\.env(?:$|\.(?!example$))/.test(path),'private dotenv forbidden');}
export function validateHistorical(receipt,manifest,{nodeId,folder,schema},load=read,sourceCheck=verifyHistoricalInputs){
 assert.equal(receipt.schema,schema);assert(/^[a-f0-9]{40}$/.test(receipt.sourceCommit)&&!/^0+$/.test(receipt.sourceCommit));
 const root='docs/audit/evidence/'+folder+'/',b=receipt.boundary;assert.equal(b.nodeId,nodeId);assert.equal(b.gate,'NOT_READY_GAPS_OPEN');assert.equal(b.stageGate,'NOT_ASSESSED');assert.equal(b.formalAccepted,false);assert.equal(b.runtimeAdmission,'DENIED');
 assert(receipt.inputs.length>0);assert.equal(new Set(receipt.inputs.map(f=>f.path)).size,receipt.inputs.length);
 for(const f of receipt.inputs){safe(f.path);assert(/^[a-f0-9]{64}$/.test(digest(f.sha256)));}
 sourceCheck(receipt.sourceCommit,receipt.inputs.map(f=>({...f,sha256:'sha256:'+digest(f.sha256)})));
 const sealed=manifest.files??manifest.artifacts;assert(Array.isArray(sealed)&&sealed.length>0);assert.equal(manifest.sourceCommit,receipt.sourceCommit);assert.equal(new Set(sealed.map(f=>f.path)).size,sealed.length);
 for(const f of sealed){safe(f.path);assert(f.path.startsWith(root));assert.equal(hash(load(f.path)),digest(f.sha256),f.path);}
 assert.equal(new Set(receipt.artifacts.map(f=>f.path)).size,receipt.artifacts.length);assert(receipt.artifacts.length>0);
 for(const f of receipt.artifacts){safe(f.path);assert(f.path.startsWith(receipt.attempt+'/'));assert.equal(hash(load(f.path)),digest(f.sha256));}
 assert(receipt.executions.length>0);assert.equal(new Set(receipt.executions.map(e=>e.id)).size,receipt.executions.length);
 for(const e of receipt.executions){const expected=e.id.includes('refusal')?1:0;assert.equal(e.exitCode,expected,e.id);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert(receipt.artifacts.some(f=>f.path===e.log&&digest(f.sha256)===digest(e.logSha256)));assert.equal(hash(load(e.log)),digest(e.logSha256));assert(Date.parse(e.finishedAt)>=Date.parse(e.startedAt));}
 return {nodeId,sourceCommit:receipt.sourceCommit,sourceInputs:receipt.inputs.length,sealedFiles:sealed.length,originalChecks:receipt.executions.length,evidenceScope:'ORIGINAL_SCOPE_ONLY',currentAdmission:'NOT_INFERRED_FROM_HISTORY',gate:b.gate,stageGate:b.stageGate,formalAccepted:false,runtimeAdmission:'DENIED'};
}
export function history(){return references.map(([nodeId,folder,schema])=>{
 const root='docs/audit/evidence/'+folder+'/',receiptPath=root+'receipt.json',manifestPath=root+'manifest.json';
 for(const p of [receiptPath,manifestPath])assert.equal(hash(read(p)),hash(execFileSync('git',['show',base+':'+p],{maxBuffer:64e6})),'historical metadata edited '+p);
 const r=json(receiptPath),summary=validateHistorical(r,json(manifestPath),{nodeId,folder,schema});git('merge-base','--is-ancestor',r.sourceCommit,base);
 const selected=['services/bff-gateway/src/assisted/persistence.rs','apps/terminal/src/audit/runtime.ts','apps/terminal/src/assisted/workspace.tsx','services/execution-gateway/src/restricted_zone.rs'].filter(p=>r.inputs.some(f=>f.path===p));
 return {...summary,receipt:receiptPath,receiptSha256:hash(read(receiptPath)),manifest:manifestPath,manifestSha256:hash(read(manifestPath)),selectedCurrentDrift:selected.filter(p=>digest(r.inputs.find(f=>f.path===p).sha256)!==hash(read(p)))};
 });}
export function boundary(){return {nodeId:'CORE-GATE:L4',engineeringGate:'PASS_L4_CURRENT_COMPOSITION_AND_GAP_ASSESSMENT',developmentAssessment:'COMPLETED_CURRENT_SCOPE',businessIntegration:'PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS',gate:'NOT_READY_GAPS_OPEN',stageGate:'NOT_ASSESSED',reviewStatus:'IN_REVIEW',formalAccepted:false,runtimeAdmission:'DENIED',m5:'PREPARED_NOT_READY',apiVersion:'1.18.0',currentCombo:'ACTUAL_P10_P11_PUBLIC_BFF_L02_MTLS_L01_OWNED_PORT_COMMON_C10_READ',identity:'REFERENCE_C01_F06_COOKIE_TLS_CORS_NOT_REAL_IDP',riskSource:'OWNED_SUBJECT_PROJECTION_NOT_CURRENT_R04_X02',persistence:'SINGLE_HOST_AUTHENTICATED_FSYNC_FILES_NOT_SUPABASE_OR_DISTRIBUTED_DB',unknown:'ORIGINAL_COMMAND_RESERVED_NO_AUTO_RESUBMIT',c10:'CURRENT_READ_ONLY_NO_EXPORT_AUTHORITY',currentFixes:['C10_CANONICAL_ORDER_REFERENCE','ASSISTED_COMMON_AUDIT_READ_CONSUMER','C10_RFC_UUID_IDENTIFIERS'],inheritedGaps:19,inheritedGapClosures:0,actualTestnetConnected:false,realIdpVaultDatabaseRls:'NOT_RUN',currentFillReconciliationAlertJoin:'NOT_JOINED',publicGlobalAccountNativeKillJoin:'NOT_JOINED',crossHostRecovery:'NOT_RUN',targetNetworkSecurityLoadNotificationSoakSameShaCIRelease:'NOT_RUN',fullBrowsersManualAccessibility:'NOT_RUN',productionCredentialsUsed:false,pushed:false,published:false,nextTask:'CORE:X02',nextPhase:'DEVELOPMENT'};}
export function validateBoundary(b){assert.deepEqual(b,boundary());}
export function plans(){const paths=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'],old=nodesFromPlans(paths.map(p=>git('show',base+':'+p))),current=nodesFromPlans();assert.equal(current.size,159);assert.equal(current.size,old.size);for(const[id,n]of current){assert.deepEqual(n.stage_gate,old.get(id).stage_gate,id);assert.deepEqual(planInput(n),planInput(old.get(id)),id);assert.equal(n.development_status,old.get(id).development_status,id);}assert.equal(current.get('CORE-GATE:L4').review_status,'IN_REVIEW');assert.equal(current.get('CORE-GATE:L4').source_commit,null);return {nodes:159,stageGatesUnchanged:true,normativeRequirementsUnchanged:true,formalAccepted:false};}
export function dependencies(){const m=nodesFromPlans();return m.get('CORE-GATE:L4').dependencies.map(nodeId=>{const n=m.get(nodeId);return{nodeId,development:n.development_status??'UNSPECIFIED',review:n.review_status??null,stageGate:n.stage_gate,requirementsDigest:hash(JSON.stringify(planInput(n))),evidenceScope:'ORIGINAL_SCOPES_PLUS_THIS_BOUNDED_CURRENT_RUN',currentAcceptance:'NOT_CLAIMED'};});}
export function gaps(){const inherited=json('docs/audit/evidence/core-l04-local-20261028/handoff.json').gaps;assert.equal(inherited.length,19);const progress={
 'G8-SERVER-FLAG-01':'Current reference capability/default-off is enforced at Web and HTTP; C11 durable activation remains absent',
 'G8-P10-P11-01':'Actual current P10/P11 uses two independent reference MFA approvals, mTLS native IO and readonly common C10; real identity/M5 unaccepted',
 'G8-C09-L01-JOIN-01':'Current same Command/Order spans public API and actual L02 mTLS to owned L01 port; trusted production risk and actual venue still absent',
 'G8-L03-L04-AUDIT-01':'Current common C10 GET consumer and canonical Orders reference repaired; local restart/unknown recovery tested, actual F06 and business DB still NOT_RUN'
 };return inherited.map(g=>({id:g.id,status:g.status,owners:g.owners,closureCriterion:g.closureCriterion,originalObservationScope:g.originalObservationScope,previousProgress:{original:g.currentProgress,coreL03:g.coreL03Progress,coreL04:g.coreL04Progress},currentObservation:progress[g.id]??'Inherited obligation preserved; this task does not revalidate or close it',closureEvidence:'NOT_CLOSED_BY_CURRENT_LOCAL_ASSESSMENT',targetReleaseObligations:g.targetReleaseObligations}));}
export function obligations(){return [
 ['L4-CURRENT-SOURCE-01','DEVELOPMENT',['CORE:X02','CORE:R04','CORE:L03'],'Current immutable Proposal and X02 signed RiskDecision, freshness/account/limits/kill revision must authorize the same public Subject','CURRENT_PRODUCT_ADAPTER_JOIN'],
 ['L4-IDENTITY-01','INTEGRATION',['CORE:F06','CORE:L03'],'Replace reference MFA/session ports with actual current identity and verify revocation at IO','REAL_IDENTITY_REQUIRES_OWN_AUTHORIZATION'],
 ['L4-LEDGER-01','DEVELOPMENT',['CORE:X04','CORE:X05','CORE:X06'],'Same current public Order/Fill must enter reconciliation ledger and Alert; unknown is reconciled read-only without resubmit','CURRENT_PRODUCT_ADAPTER_JOIN'],
 ['L4-NATIVE-CONTROL-01','DEVELOPMENT',['CORE:X02','CORE:X06','CORE:L04'],'Join public global/account kill controls to the durable native stop, audit and current generation','CURRENT_PRODUCT_ADAPTER_JOIN'],
 ['L4-C11-ACTIVATION-01','DEVELOPMENT',['CORE:X06','FE:UI-P14'],'Current scoped versioned activation/history must control runtime instead of reference enabled flag','CURRENT_PRODUCT_ADAPTER_JOIN'],
 ['L4-PERSISTENCE-01','RELEASE',['CORE:F05','CORE:F07','CORE:L02','CORE:L04'],'Actual Supabase/Vault/RLS transactional reservations/common audit/outbox/recovery and cross-host fencing','TARGET_NOT_RUN_MODULE_OPT_IN_REQUIRED'],
 ['L4-TESTNET-01','INTEGRATION',['CORE:L01','CORE:L02','CORE:L03','FRONTEND-GATE:G8'],'Authorized real testnet MFA/two-person representative workflow; native protocol samples do not count as venue orders','EXTERNAL_AUTHORIZATION_NOT_GRANTED'],
 ['L4-RELEASE-01','RELEASE',['CORE:F07','CORE:F09','CORE:L04'],'Target isolation/network/rotation, load/security, four deployed drills, durable audit, actual notifications/soak/same-SHA CI and Beta/Live readiness','TARGET_NOT_RUN_NO_PRODUCTION_AUTHORIZATION']
 ].map(([id,phase,owners,criterion,reason])=>({id,phase,owners,criterion,status:'OPEN',evidence:'NOT_RUN_OR_NOT_JOINED',reason,developmentPrerequisite:false}));}
export function buildAssessment(){return {schema:'quantos-core-l4-current-assessment/v1',boundary:boundary(),sourceBinding:{receipt:'docs/audit/evidence/core-l4-current-local-20261028/receipt.json',mechanism:'FROZEN_CURRENT_SOURCE_AND_SEPARATE_ORIGINAL_SCOPE_HASHES'},plans:plans(),dependencies:dependencies(),references:history(),gaps:gaps(),obligations:obligations(),reviewDimensions:[
 {name:'Product',finding:'Current bounded approval/Command/Order/common audit works; actual risk/identity/venue and wider business chain remain open'},
 {name:'Frontend',finding:'P10/P11 to mTLS common C10 readonly consumption and canonical order reference repaired; export denied'},
 {name:'BFF',finding:'Same public request, command/order and C10 nodes preserve scope and default off; live startup unchanged'},
 {name:'QA',finding:'Current scoped browser/HTTP/refusal/recovery and direct regressions are separate from immutable historical receipts'},
 {name:'Security',finding:'Temporary CA and owned signer do not establish Vault/OS/network/target security; no zero-high-risk claim'},
 {name:'Risk',finding:'Own projected source, single-host state and unknown quarantine cannot close actual risk/ledger/testnet obligations'}
 ],formalConfirmation:{status:'PENDING_USER_REVIEW',approval:null,selfApproved:false},retainedTargets:{venueMappingScenarios:200,independentApprovalJourneys:50,defaultOffRefusalPercent:100,duplicateCommandOrderTarget:0,durableTargetAuditPercent:100,targetDrills:4,highRiskTarget:0,currentTargetAcceptance:'NOT_RUN',historicalCounts:'ORIGINAL_SCOPE_ONLY_NOT_CURRENT_EXECUTIONS'},next:{nodeId:'CORE:X02',phase:'DEVELOPMENT',obligation:'L4-CURRENT-SOURCE-01',scope:'CURRENT_R04_PROPOSAL_SIGNED_RISK_DECISION_AND_KILL_GENERATION_TO_PUBLIC_ASSISTED_SUBJECT_NO_EXTERNAL_AUTHORIZATION'}};}
export function validateAssessment(a,expected=buildAssessment()){assert.deepEqual(a,expected);validateBoundary(a.boundary);assert.equal(new Set(a.gaps.map(g=>g.id)).size,19);assert(a.gaps.every(g=>g.status==='OPEN'));assert.equal(a.dependencies.length,4);assert.equal(a.references.length,5);assert.equal(a.obligations.length,8);for(const o of a.obligations)assert(o.owners.every(id=>nodesFromPlans().has(id)));assert.equal(a.formalConfirmation.approval,null);return a;}
