import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {boundary,scopePath,validateFlow,validateUnknown,validateRun,checks} from './core-l04-current-execution.mjs';
test('current execution scope preserves full Gate and original denominators',()=>{boundary();});
for(const[k,v]of Object.entries({formalAccepted:true,runtimeAdmission:'ALLOWED',limitsRelaxed:true,originalGenerationPreserved:false,gate:'READY',stageGate:'READY',nativeCommandAdmission:'LIVE',m5:'READY'}))test('reject promotion '+k,()=>{const s=JSON.parse(readFileSync(scopePath));s.boundary[k]=v;assert.throws(()=>boundary(s));});
test('scope cannot erase inherited obligations or approve itself',()=>{for(const key of ['obligations','inheritedGaps']){const s=JSON.parse(readFileSync(scopePath));s[key].pop();assert.throws(()=>boundary(s));}});
test('zero executions cannot become current PASS',()=>{assert(checks.length>15);assert.throws(()=>validateRun({executions:[]}));});
test('synthetic empty success cannot become native execution proof',()=>{assert.throws(()=>validateFlow({sourceCommit:'same',scope:'ACTUAL_PUBLIC_REFERENCE_BFF_OWNED_MTLS_CURRENT_ETH_EXECUTION',protocolCalls:0},'same'));});
test('UNKNOWN without original claims cannot become resolved proof',()=>{assert.throws(()=>validateUnknown({sourceCommit:'same',scope:'ACTUAL_CURRENT_COMMAND_CRASH_AFTER_ZONE_COMMIT',view:{command:{state:'accepted'}}},'same'));});
