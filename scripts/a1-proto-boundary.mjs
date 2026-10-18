import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),temp=mkdtempSync(join(tmpdir(),'quantos-a1-proto-'));let steps=0;
try{for(const args of [['format','--diff','--exit-code'],['lint'],['build','-o',temp+'/descriptor.bin'],['breaking','--against','.git#ref=46492dea04d3a1df0492c3cc630b93d65387f41a']]){execFileSync(root+'/node_modules/.bin/buf',args,{cwd:root,stdio:'inherit',timeout:120000});steps++;}execFileSync(process.execPath,['scripts/check-json-schemas.mjs'],{cwd:root,stdio:'inherit'});console.log('A1_PROTO_BOUNDARY='+JSON.stringify({status:'PASS',steps,baseline:'46492dea04d3a1df0492c3cc630b93d65387f41a',remoteCodegen:'NOT_RUN',fullF03Gate:'NOT_RUN'}));}finally{rmSync(temp,{recursive:true,force:true});}
