import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
// Total functional execution budget, not service latency or release performance.
export const commandBudget=name=>name==='database'?900000:300000;
export function runCommand(name,command,{cwd,env,execute=spawnSync,now=()=>performance.now()}={}){
 const timeoutMs=commandBudget(name),start=now();
 const run=execute(command[0],command.slice(1),{cwd,env,encoding:'utf8',timeout:timeoutMs,maxBuffer:8*1024*1024});
 return {...run,diagnostics:{timeoutMs,elapsedMs:now()-start,timedOut:run.error?.code==='ETIMEDOUT',signal:run.signal??null,errorCode:run.error?.code??null}};
}
