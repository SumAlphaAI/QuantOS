// Explicit local L02 process with ephemeral owned CA/signer and no venue network.
import {spawn,execFileSync,type ChildProcess} from 'node:child_process';
import {mkdtemp,readFile,writeFile,chmod,readdir,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes,X509Certificate} from 'node:crypto';
export async function ownedZone(currentReviewExecutionEnabled=false){
 if(['DATABASE_URL','QUANTOS_EXECUTION_DATABASE_URL','SUPABASE_SERVICE_ROLE_KEY','BINANCE_API_KEY','BINANCE_API_SECRET'].some(k=>process.env[k]))throw Error('Owned zone must not load credentials');
 const directory=await realpath(await mkdtemp(join(tmpdir(),'quantos-l02-')));await chmod(directory,0o700);let child:ChildProcess|undefined,protocolCalls=0;
 const ssl=(args:string[])=>execFileSync('openssl',args,{cwd:directory,stdio:'ignore'});
 const close=async()=>{if(child&&child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(r=>child!.once('close',r));}await rm(directory,{recursive:true,force:true});};
 try{
  ssl(['req','-x509','-newkey','rsa:2048','-nodes','-keyout','ca-key.pem','-out','ca.pem','-days','1','-subj','/CN=core-l4-owned-ca','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign']);
  for(const [name,cn,usage]of [['server','execution-zone.invalid','serverAuth'],['peer-1','execution-worker.invalid','clientAuth']]){
   ssl(['req','-new','-newkey','rsa:2048','-nodes','-keyout',name+'-key.pem','-out',name+'.csr','-subj','/CN='+cn]);
   await writeFile(join(directory,name+'.ext'),`basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=${usage}\nsubjectAltName=DNS:${cn}\n`,{mode:0o600});
   ssl(['x509','-req','-in',name+'.csr','-CA','ca.pem','-CAkey','ca-key.pem','-CAcreateserial','-out',name+'.pem','-days','1','-extfile',name+'.ext']);
  }
  await writeFile(join(directory,'peer-2.pem'),await readFile(join(directory,'peer-1.pem')),{mode:0o600});
  const at=new Date(Math.floor(Date.now()/1000)*1000),expiresAt=new Date(at.getTime()+300000);
  await writeFile(join(directory,'config.json'),JSON.stringify({account:'44444444-4444-4444-8444-444444444444',now:at,rotation:false,schedule:[],wallClock:true}),{mode:0o600});
  for(const name of await readdir(directory))await chmod(join(directory,name),0o600);
  child=spawn(resolve('target/debug/execution-gateway'),['--l02-owned-zone-fixture',directory],{env:{TMPDIR:tmpdir()},stdio:['ignore','pipe','ignore']});
  const ready=await new Promise<{pid:number;address:string;backend:string;serverFingerprint:string}>((done,reject)=>{
   const timer=setTimeout(()=>reject(Error('owned zone startup timeout')),10000);let buffer='';
   child!.once('error',e=>{clearTimeout(timer);reject(e);});child!.once('exit',()=>{clearTimeout(timer);reject(Error('owned zone exited'));});
   child!.stdout!.on('data',b=>{buffer+=String(b);let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(line.startsWith('L02_READY=')){clearTimeout(timer);done(JSON.parse(line.slice(10)));}if(line.startsWith('L02_TRACE='))protocolCalls=JSON.parse(line.slice(10)).protocolCalls;}});
  });
  if(ready.pid!==child.pid||ready.backend!=='OWNED_L02_MTLS'||!ready.address.startsWith('127.0.0.1:'))throw Error('Unexpected owned zone identity');
  const fingerprint='sha256:'+new X509Certificate(await readFile(join(directory,'server.pem'))).fingerprint256.replaceAll(':','').toLowerCase();if(fingerprint!==ready.serverFingerprint)throw Error('Wrong owned server pin');
  await writeFile(join(directory,'bff-owner.json'),JSON.stringify({currentReviewExecutionEnabled,address:ready.address,serverFingerprint:fingerprint,sessionHash:'sha256:'+'1'.repeat(64),keys:Array.from({length:4},()=>Array.from(randomBytes(32))),createdAt:at,expiresAt}),{mode:0o600});
  return{directory,close,snapshot:()=>({backend:ready.backend,pid:ready.pid,protocolCalls,actualTestnetConnected:false})};
 }catch(e){await close();throw e;}
}
