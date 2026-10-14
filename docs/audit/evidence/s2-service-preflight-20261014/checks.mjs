import {base} from './scope.mjs';
export const checks=[
 {id:'prerequisite-proof',command:['node','docs/audit/evidence/x03-replay-fix-20261014/verify-local.mjs'],expected:0,pattern:'"nodes": 27'},
 {id:'prior-seal',command:['python3','docs/audit/evidence/x03-replay-fix-20261014/seal.py','--verify'],expected:0,pattern:'PASS'},
 {id:'local-admission-refusal',command:['node',base+'/scope.mjs','--admission'],expected:2,pattern:'LOCAL_ADMISSION_BLOCKED'},
 {id:'openapi',command:['node','scripts/check-bff-openapi.mjs'],expected:0},
 {id:'generated',command:['node','scripts/check-bff-generated.mjs'],expected:0},
 {id:'catalog',command:['node','scripts/check-bff-contract-coverage.mjs'],expected:0},
 {id:'fixtures-negative',command:['node','--test','--test-reporter=tap',base+'/preflight.test.mjs'],expected:0,minTests:51},
 {id:'sync-local',command:['node','--test','--test-reporter=tap','scripts/tests/sync-vibe.test.mjs','scripts/tests/sync-vibe-cli.test.mjs'],expected:0,minTests:23},
 {id:'rollout-local',command:['node','--test','--test-reporter=tap','scripts/tests/tp01-vibe-rollout.test.mjs'],expected:0,minTests:4},
 {id:'rollout-boundary',command:['node',base+'/boundary-probe.mjs','rollout','@OUT@/rollout.json','--require-complete'],expected:2,pattern:'LOCAL_FUNCTIONAL_GAPS',artifact:'rollout.json'},
 {id:'evaluation-boundary',command:['node',base+'/boundary-probe.mjs','evaluation','@OUT@/evaluation.json','--require-complete'],expected:2,pattern:'LOCAL_EVALUATION_GAPS',artifact:'evaluation.json'},
 {id:'strategy-domain',command:['cargo','test','--locked','--offline','-p','quantos-strategy','--lib'],expected:0,pattern:'hundred_unverified_or_unapproved_deployments_are_all_rejected ... ok',minTests:15},
 {id:'python-boundaries',command:['engines/.venv/bin/python','-m','pytest','engines/tests/test_strategy_lab_contract.py','engines/tests/test_vibe_adapter_contract.py','engines/tests/test_vibe_adapter_absorption.py','engines/tests/test_vibe_adapter_skeleton.py','engines/tests/test_tp12_nautilus_agents_rules.py','-q'],expected:0,minTests:100},
 {id:'strategy-bridge',command:['cargo','test','--locked','--offline','-p','quantos-engine-manager','--test','python_strategy_lab'],expected:0,minTests:1},
 {id:'bff-build',command:['cargo','build','--locked','--offline','-p','bff-gateway'],expected:0},
 {id:'actual-routes',command:['node',base+'/route-probe.mjs','@OUT@/http','--require-implemented'],expected:2,pattern:'LOCAL_PROVIDER_GAPS',artifact:'http/receipt.json'},
 {id:'plans',command:['pnpm','check:development-plans'],expected:0},
 {id:'plans-negative',command:['node','--test','--test-reporter=tap','scripts/development-plan-order-negative.mjs'],expected:0,minTests:42},
 {id:'handoff',command:['make','development-handoff-check'],expected:0},
];
export const resolveCommand=(c,out)=>c.command.map(s=>s.replaceAll('@OUT@',out));
export function testCounts(log){
 let m=log.match(/^# tests (\d+)$/m);if(m)return {kind:'node',total:+m[1],passed:+log.match(/^# pass (\d+)$/m)[1],failed:+log.match(/^# fail (\d+)$/m)[1],skipped:+(log.match(/^# skipped (\d+)$/m)?.[1]??0)};
 const cargo=[...log.matchAll(/test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored/g)];if(cargo.length)return {kind:'rust',passed:cargo.reduce((a,m)=>a+(+m[1]),0),failed:cargo.reduce((a,m)=>a+(+m[2]),0),ignored:cargo.reduce((a,m)=>a+(+m[3]),0)};
 m=log.match(/(\d+) passed(?:, (\d+) skipped)? in /);if(m)return {kind:'python',passed:+m[1],failed:0,skipped:+(m[2]??0)};
 m=log.match(/#\s*pass\s+(\d+)/);if(m)return {kind:'node',passed:+m[1],failed:+(log.match(/#\s*fail\s+(\d+)/)?.[1]??0)};
 return null;
}
