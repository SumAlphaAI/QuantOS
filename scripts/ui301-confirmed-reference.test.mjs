import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {directory,validateRecord,verify} from './ui301-confirmed-reference.mjs';
test('UI301 original prose confirmation binds immutable source, packet and original failures',()=>assert.equal(verify().status,'CONFIRMED'));
test('UI301 rejects changed raw reply, candidate and promoted scope',()=>{const r=JSON.parse(readFileSync(directory+'/user-confirmation.json')),scope=JSON.parse(readFileSync(directory+'/scope.json')),raw=readFileSync(directory+'/raw-user-message.txt','utf8');for(const [key,value]of Object.entries({decision:'PENDING',formalAccepted:true,runtimeAdmission:'ALLOWED',axeIncomplete:0,documentCommit:'a'.repeat(40),scopeAdmission:'RELEASE'}))assert.throws(()=>validateRecord({...r,[key]:value},scope,raw));assert.throws(()=>validateRecord(r,scope,raw+'changed'));assert.throws(()=>validateRecord({...r,request:{...r.request,sourceCommit:'b'.repeat(40)}},scope,raw));});
