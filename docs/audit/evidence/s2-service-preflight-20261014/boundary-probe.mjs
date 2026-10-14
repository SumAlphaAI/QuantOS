import assert from 'node:assert/strict';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {evaluateRollout,buildRolloutState,applyRollback} from '../../../../scripts/tp01-vibe-rollout-lib.mjs';
import {base} from './scope.mjs';
const json=p=>JSON.parse(readFileSync(p)),policyDocument=json('third_party/vibe-trading/canary-policy.json'),scenario=json('scripts/fixtures/tp01-vibe-canary/healthy-7d.json');
export function rolloutProbe(){
 const inputs=structuredClone(scenario); // Self-owned synthetic observations, never elapsed-window evidence.
 const r=evaluateRollout({policyDocument,scenario:inputs});assert.equal(r.outcome,'canary_passed');
 const rejected=structuredClone(inputs);rejected.observations.signedArtifactsPresent=false;
 const bad=evaluateRollout({policyDocument,scenario:rejected});assert.equal(bad.blocked,true);assert.equal(bad.capabilityFlag.state,'disabled');
 const state=buildRolloutState(r),disabled=applyRollback({state,action:'disable',reason:'local synthetic preflight',completedAt:'2026-10-14T00:00:00Z'}),rolled=applyRollback({state,action:'rollback',reason:'local synthetic preflight',completedAt:'2026-10-14T00:00:00Z'});
 assert.equal(disabled.capabilityFlag.rolloutPercent,0);assert.deepEqual(rolled.activeRelease,state.previousRelease);
 const code=readFileSync('scripts/tp01-vibe-rollout-lib.mjs','utf8');
 assert(!/verifySignature|createVerify|\.verify\(/.test(code));
 return {status:'LOCAL_FUNCTIONAL_GAPS',scope:'Pure JSON rollout evaluator; no live rollout performed',observed:{positiveObservationEnables:r.outcome,unsignedObservationRejected:bad.outcome,disable:disabled.status,rollback:rolled.status},gaps:['signedArtifactsPresent=true is trusted without cryptographic verification in this evaluator','runtimeIsolationVerified=true is trusted; disabled/rollback JSON is not consumed by a running adapter or in-flight cleanup controller'],releaseWindowAccepted:false,performanceAccepted:false};
}
export function evaluationProbe(){
 const required=['third_party/nautilus_trader/baseline.lock.json','third_party/nautilus_trader/sbom.spdx.json'];
 const adr=readFileSync('docs/adr/20260731-tp07-nautilus-license-compliance.md','utf8');assert(adr.includes('fa86c6e39e8f064d5922c0ee4da5e2a9a2716408'));
 const agents=json('third_party/nautilus-agents/baseline.lock.json'),rules=json('third_party/nautilus-agents/no-coupling-rules.json');assert.equal(agents.policy.decision,'reference_only');assert(rules.rules.length>=5);
 return {status:'LOCAL_EVALUATION_GAPS',tp07:{referenceCommit:'fa86c6e39e8f064d5922c0ee4da5e2a9a2716408',license:'ADR reference assertion only; no upstream lookup performed',missing:required.filter(p=>!existsSync(p)),cve:'NO_PINNED_TP07_CVE_EVIDENCE',capabilityInventory:'ADR/wire mapping exists; dedicated evaluation inventory missing',runtimeAdoption:false},tp12:{referenceCommit:agents.upstream.commit,decision:agents.policy.decision,rules:rules.rules.length,cve:agents.cveAudit.status,runtimeAdoption:false},externalExecution:false};
}
if(process.argv[1]?.endsWith('/boundary-probe.mjs')){
 const mode=process.argv[2];assert(['rollout','evaluation'].includes(mode));const result=mode==='rollout'?rolloutProbe():evaluationProbe();
 if(process.argv[3]){assert(process.argv[3].startsWith(base+'/attempt-')&&!existsSync(process.argv[3]));writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify(result,null,2));if(process.argv.includes('--require-complete'))process.exitCode=2;
}
