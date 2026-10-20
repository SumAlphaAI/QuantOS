import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{readFileSync,writeFileSync}from'node:fs';import{createHash}from'node:crypto';
import ts from 'typescript';
const D='docs/audit/evidence/g0-legacy-local-20261020',hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const receipt=JSON.parse(readFileSync(D+'/function-attempt-02/function-receipt.json'));
const rows=[];
for(const domain of ['terminal','strategy','execution','ops']){
 const path='packages/api-client/src/'+domain+'.ts',before=readFileSync(D+'/preflight/'+path,'utf8'),after=readFileSync(path,'utf8');
 const declarations=text=>new Map(ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true).statements.filter(n=>ts.isInterfaceDeclaration(n)||ts.isTypeAliasDeclaration(n)).map(n=>[n.name.text,n.getText()]));
 assert.equal(after,execFileSync('git',['show',receipt.observedSourceCommit+':'+path],{encoding:'utf8'}));assert.equal(before,execFileSync('git',['show','f7141e4b:'+path],{encoding:'utf8'}));
 const old=declarations(before),current=declarations(after),port=domain[0].toUpperCase()+domain.slice(1)+'Backend';
 for(const[name,text]of old)if(name!==port)assert.equal(current.get(name),text,'UI compatibility type changed '+name);
 assert(!current.has(port));assert.deepEqual([...current.keys()].filter(n=>!old.has(n)),domain==='terminal'?['TerminalClient']:[]);
 rows.push({path,baselineSha256:hash(before),currentSha256:hash(after),unchangedUiTypeDeclarations:old.size-1,removedPort:port,addedTypeOnlyView:domain==='terminal'?'TerminalClient':null});
}
writeFileSync(D+'/type-preservation.json',JSON.stringify({schema:'quantos-legacy-type-preservation/v1',status:'PASS',sourceCommit:receipt.observedSourceCommit,baselineCommit:'f7141e4b',rows,scope:'Compatibility UI type bodies unchanged; old backend ports moved into private fixtures; TerminalClient runtime replaced by an explicit type-only UI view; no OpenAPI/provider mutation'},null,2)+'\n');console.log(JSON.stringify(rows,null,2));
