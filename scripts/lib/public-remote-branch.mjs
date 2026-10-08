import {execFileSync} from 'node:child_process';
// Read-only Git discovery retries only a transport timeout; semantic failures are final.
export function publicRemoteBranch(remoteUrl,branch,{execute=execFileSync,diagnose=value=>console.error(JSON.stringify(value))}={}){
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const result=execute('git',['-c','credential.helper=','ls-remote','--exit-code',remoteUrl,`refs/heads/${branch}`],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}}).trim();
   diagnose({check:'public-remote-branch',attempt,status:'PASS',timeoutMs:15000});return result;
  }catch(error){
   diagnose({check:'public-remote-branch',attempt,status:'FAIL',code:error.code??null,exitStatus:error.status??null,timeoutMs:15000});
   if(error.status===2)throw Error(`required remote branch ${branch} is missing from ${remoteUrl}`);
   if(error.code!=='ETIMEDOUT'||attempt===3)throw error;
  }
 }
}
