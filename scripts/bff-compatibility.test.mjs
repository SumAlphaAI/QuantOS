import assert from 'node:assert/strict';
import test from 'node:test';
import {validateCompatibility} from './bff-compatibility.mjs';
const account={in:'query',name:'accountId',required:true,schema:{type:'string'}};
const optional={in:'query',name:'includeAdmission',required:false,schema:{type:'string',enum:['true']}};
const doc=parameters=>({info:{version:'1.17.0'},paths:{'/x':{get:{parameters}}}});
const check=parameters=>validateCompatibility(doc([account]),doc(parameters)).status;
test('optional opt-in input preserves existing callers, including parameter order',()=>{
  assert.equal(check([account,optional]),'PASS');
  assert.equal(check([optional,account]),'PASS');
  assert.equal(check([account,{...optional,required:undefined}]),'PASS');
});
for(const [name,parameters] of [
  ['required addition',[account,{...optional,required:true}]],
  ['optional path addition',[account,{...optional,in:'path'}]],
  ['unresolved reference addition',[account,{$ref:'#/components/parameters/Unknown'}]],
  ['duplicate identity',[account,optional,{...optional}]],
  ['required tightening',[{...account,schema:{type:'string',enum:['one']}},optional]],
  ['removed original',[optional]],
  ['renamed original',[{...account,name:'other'},optional]],
  ['moved original',[{...account,in:'header'},optional]],
  ['changed original requirement',[{...account,required:false},optional]],
])test(name+' retains fail-closed whole-array comparison',()=>assert.equal(check(parameters),'FAIL'));
test('a referenced original cannot be silently resolved or dropped',()=>{
  const before=doc([{$ref:'#/components/parameters/Account'}]);
  assert.equal(validateCompatibility(before,doc([account,optional])).status,'FAIL');
});
