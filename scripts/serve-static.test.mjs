import test from 'node:test';
import process from 'node:process';
import {setTimeout,clearTimeout} from 'node:timers';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
test('actual static host resolves a page with nested children, declared UUIDs and closed 404s',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'quantos-ui201-static-'));let child;
 try{
  await mkdir(join(dir,'research'));await writeFile(join(dir,'research.html'),'Research list');await writeFile(join(dir,'research/new.html'),'Research create');await writeFile(join(dir,'audit.html'),'Audit');await writeFile(join(dir,'404.html'),'Closed 404');
  await writeFile(join(dir,'terminal-route-map.json'),JSON.stringify({schema:'quantos-terminal-static-routes/v1',routes:[{prefix:'audit',document:'audit.html'}]}));
  const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
  child=spawn(process.execPath,[resolve('scripts/serve-static.mjs'),dir,String(port)],{stdio:['ignore','pipe','pipe']});
  await new Promise((done,reject)=>{const t=setTimeout(()=>reject(Error('static host startup timeout')),5000);child.once('error',e=>{clearTimeout(t);reject(e);});child.stdout.on('data',()=>{clearTimeout(t);done();});});
  for(const [path,status,body]of [['/research',200,'Research list'],['/research/',200,'Research list'],['/research/new',200,'Research create'],['/research/new/',200,'Research create'],['/audit/aaaaaaaa-1111-4111-8111-111111111111',200,'Audit'],['/research/unknown',404,'Closed 404'],['/audit/nope',404,'Closed 404']]){const r=await globalThis.fetch(`http://127.0.0.1:${port}${path}`,{signal:globalThis.AbortSignal.timeout(3000)});assert.equal(r.status,status,path);assert.equal(await r.text(),body,path);}
 }finally{if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}await rm(dir,{recursive:true,force:true});}
});
