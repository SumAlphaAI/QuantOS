import test from 'node:test';import assert from 'node:assert/strict';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
import {checkStages,requireAdmission,requireRelease,handoff} from './r02-stage-check.mjs';
test('component passes while missing dependency/whole release admission rejects',()=>{assert.equal(checkStages().admitted,false);assert.throws(()=>requireAdmission());assert.throws(()=>requireRelease());});
test('static COMPLETED is never dependency admission',()=>{const nodes=nodesFromPlans();for(const id of ['CORE:R01','CORE:F06','CORE-GATE:F0'])nodes.get(id).development_status='COMPLETED';assert.throws(()=>requireAdmission({nodes}));});
test('READY declarations still execute strict receipt validation',()=>{const nodes=nodesFromPlans();for(const id of ['CORE:R01','CORE:F06','CORE-GATE:F0'])nodes.get(id).stage_gate.status='READY';let called=0;assert.throws(()=>requireAdmission({nodes,validate:()=>{called++;throw Error('stale content');}}));assert.equal(called,1);});
for(const mutate of [n=>n.get('RELEASE-GATE:BETA').required_scope=n.get('RELEASE-GATE:BETA').required_scope.replace(handoff,''),n=>n.get('RELEASE-GATE:BETA').stage_gate.stage='DEVELOPMENT',n=>n.get('CORE:R02').dependencies.pop()])test('release handoff and dependency changes fail closed '+mutate.toString(),()=>{const nodes=nodesFromPlans();mutate(nodes);assert.throws(()=>checkStages({nodes}));});
