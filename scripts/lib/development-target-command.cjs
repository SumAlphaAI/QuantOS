const {spawn}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const assert=require('node:assert/strict');
const {StringDecoder}=require('node:string_decoder');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function redact(text,env){for(const[k,v]of Object.entries(env))if(v&&v.length>=6&&/PASSWORD|TOKEN|KEY|DATABASE_URL|TEST_EMAIL/i.test(k))text=text.split(v).join('[REDACTED]');return text;}
async function executeTarget(command,args,{cwd,env=process.env,timeoutMs=900000,onStart=()=>{},abortSignal,maxBytes=16*1024*1024}={}){
 assert(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=900000,'bounded target command deadline required');
 const started=performance.now();const child=spawn(command,args,{cwd,env,detached:true,stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='',bytes=0,timedOut=false,errorCode=null,killTimer,leaked=false;
 const stdoutDecoder=new StringDecoder('utf8'),stderrDecoder=new StringDecoder('utf8');
 const groupAlive=()=>{if(!child.pid)return false;try{process.kill(-child.pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}};
 const signal=kind=>{if(child.pid)try{process.kill(-child.pid,kind);}catch(e){if(e.code!=='ESRCH')throw e;}};
 const stop=code=>{errorCode||=code;timedOut||=code==='ETIMEDOUT';signal('SIGTERM');killTimer??=setTimeout(()=>signal('SIGKILL'),1000);};
 const add=(chunk,stream)=>{bytes+=chunk.length;if(bytes<=maxBytes){if(stream==='out')stdout+=stdoutDecoder.write(chunk);else stderr+=stderrDecoder.write(chunk);}else {stdout='';stderr='';stop('OUTPUT_LIMIT_EXCEEDED');}};
 child.stdout.on('data',chunk=>add(chunk,'out'));child.stderr.on('data',chunk=>add(chunk,'err'));
 const done=new Promise(resolve=>{child.once('error',e=>{errorCode=e.code||'SPAWN_ERROR';});child.once('close',(code,signal)=>resolve({code,signal}));});
 const timer=setTimeout(()=>stop('ETIMEDOUT'),timeoutMs);
 const abort=()=>stop('CANCELLED');abortSignal?.addEventListener('abort',abort,{once:true});if(abortSignal?.aborted)abort();
 try{onStart({pid:child.pid,timeoutMs,startedAt:new Date().toISOString()});}catch{stop('EVIDENCE_WRITE_FAILED');}
 const exit=await done;clearTimeout(timer);abortSignal?.removeEventListener('abort',abort);if(killTimer)clearTimeout(killTimer);
 if(groupAlive()){leaked=true;signal('SIGTERM');await pause(100);if(groupAlive()){signal('SIGKILL');await pause(100);}}
 const processGroupClosed=!groupAlive();
 const rawOutput=stdout+stdoutDecoder.end()+stderr+stderrDecoder.end();
 const output=bytes>maxBytes?'[OUTPUT_LIMIT_EXCEEDED; raw output withheld]':redact(rawOutput,env);
 const secretLeakDetected=bytes<=maxBytes&&output!==rawOutput;
 if(secretLeakDetected)errorCode||='SECRET_LEAK_DETECTED';
 return {exitCode:exit.code===0&&(errorCode||leaked||!processGroupClosed)?1:exit.code,signal:exit.signal,timedOut,errorCode,
 elapsedMs:performance.now()-started,timeoutMs,processGroupClosed,orphanDetected:leaked,secretLeakDetected,output};
}
module.exports={executeTarget,redact};
