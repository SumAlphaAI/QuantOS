import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {directory,validateRecord,verify} from './ui-p06-confirmed-reference.mjs';
test('P06 user confirmation binds original complete packet and pending draft',()=>assert.equal(verify().status,'CONFIRMED'));
test('P06 confirmation refuses altered reply, candidate and acceptance promotion',()=>{const r=JSON.parse(readFileSync(directory+'/user-confirmation.json')),raw=readFileSync(directory+'/raw-user-message.txt','utf8');for(const[k,v]of Object.entries({formalAccepted:true,runtimeAdmission:'ALLOWED',documentCommit:'a'.repeat(40),allNotRunRetained:false,functionRerun:true}))assert.throws(()=>validateRecord({...r,[k]:v},raw));assert.throws(()=>validateRecord(r,raw+'changed'));assert.throws(()=>validateRecord({...r,request:{...r.request,sourceCommit:'b'.repeat(40)}},raw));});
