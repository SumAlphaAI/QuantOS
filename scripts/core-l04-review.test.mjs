import assert from 'node:assert/strict';
import {test} from 'node:test';
import {boundary,validateBoundary,validateFlow,checks,expectedRustCases,validateRustCases} from './core-l04-review.mjs';
const source='1'.repeat(40);
const flow=()=>({sourceCommit:source,sameSource:true,mutualTls:true,realBffProcesses:true,unknownNotReissued:true,corruptStoreDenied:true,replicaRequests:12,nativeProtocolCalls:1,commonC10Nodes:5,actualTestnetConnected:false,gate:'NOT_READY_GAPS_OPEN',runtimeAdmission:'DENIED',fourDrills:['replay','process-recovery','engine-fault','kill-switch']});
const crash=()=>({sourceCommit:source,zoneProtocolCallsBeforeKill:1,callerObservedResponseLoss:true,recoveredState:'unknown',recoveredOrderAbsent:true,commonC10ReservationNodes:4,noReplayTrace:true,actualTestnetConnected:false});
test('L04 local boundary and actual crash result are internally consistent',()=>{validateBoundary(boundary());validateFlow(flow(),crash(),source);assert.equal(checks.length,22);assert(!checks.some(c=>c[1].includes('--workspace')));});
for(const key of Object.keys(boundary()))test('boundary refuses altered '+key,()=>{const b=boundary();b[key]=typeof b[key]==='boolean'?!b[key]:'PROMOTED';assert.throws(()=>validateBoundary(b));});
for(const key of Object.keys(flow()))test('flow refuses altered '+key,()=>{const f=flow();f[key]=null;assert.throws(()=>validateFlow(f,crash(),source));});
for(const key of Object.keys(crash()))test('crash refuses altered '+key,()=>{const c=crash();c[key]=null;assert.throws(()=>validateFlow(flow(),c,source));});

test('L02 existing process suite has four cases',()=>{validateRustCases(expectedRustCases);});
test('incorrect two-case L02 expectation refuses',()=>{assert.throws(()=>validateRustCases({...expectedRustCases,'l02-process':2}));});
test('empty process proof refuses',()=>{assert.throws(()=>validateRustCases({...expectedRustCases,'public-process':0}));});
