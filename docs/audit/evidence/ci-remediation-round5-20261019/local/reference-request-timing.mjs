import {spawn} from 'node:child_process';import {createServer}from'node:net';import{once}from'node:events';import{resolve}from'node:path';
const cwd=process.cwd(),binary=resolve(process.env.CARGO_TARGET_DIR||'target','debug/bff-gateway');
const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const {port}=socket.address();await new Promise(r=>socket.close(r));
let stderr='';const started=performance.now(),child=spawn(binary,[],{cwd,env:{PATH:process.env.PATH,HOME:process.env.HOME,QUANTOS_SKIP_ENV:'1',QUANTOS_BFF_MODE:'reference',QUANTOS_BFF_BIND:`127.0.0.1:${port}`},stdio:['ignore','pipe','pipe']});child.stderr.on('data',b=>stderr+=b);
const deadline=setTimeout(()=>child.kill(),90000);try{
await new Promise((r,j)=>{child.stdout.on('data',b=>{if(String(b).includes('"ready":true'))r()});child.once('error',j);child.once('exit',()=>j(Error(stderr||'early exit')))});console.log(JSON.stringify({phase:'ready',elapsedMs:performance.now()-started}));
for(const path of ['/v1/context','/v1/proposals','/v1/strategies','/v1/operations/health']){const start=performance.now();const res=await fetch(`http://127.0.0.1:${port}${path}`,{headers:{cookie:'quantos_session=session-current'},signal:AbortSignal.timeout(60000)});await res.arrayBuffer();console.log(JSON.stringify({path,status:res.status,elapsedMs:performance.now()-start}));}
}finally{clearTimeout(deadline);child.kill();await once(child,'close');}
