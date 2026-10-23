import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {directory,validateRecord,verify} from './frontend-g3-confirmed-reference.mjs';
test('G3 original candidate tooling packet and raw confirmation are bound',()=>assert.equal(verify().status,'CONFIRMED'));
test('G3 confirmation rejects source tooling reply and acceptance promotion',()=>{const r=JSON.parse(readFileSync(directory+'/user-confirmation.json')),raw=readFileSync(directory+'/raw-user-message.txt','utf8');for(const change of [{request:{...r.request,sourceCommit:'a'.repeat(40)}},{packetCommit:'a'.repeat(40)},{formalAccepted:true},{runtimeAdmission:'ALLOWED'},{allNotRunRetained:false},{incomplete:{}}])assert.throws(()=>validateRecord({...r,...change},raw));assert.throws(()=>validateRecord(r,raw+'extra'));});
