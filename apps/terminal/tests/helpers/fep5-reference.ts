import {spawn,type ChildProcess} from 'node:child_process';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createBffClient} from '@sumalpha/api-client';
import {referenceBffExecutable,referenceBffRoot,referenceBffSourceEnv} from './reference-bff';
export const csrf='csrf-token-0000000000000001';
const hash=(s:string|Uint8Array)=>'sha256:'+createHash('sha256').update(s).digest('hex');
export async function reference(mode:'paper'|'shadow'='paper'){
 if(process.env.DATABASE_URL||process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Reference environment must exclude credentials');
 const reserve=createServer();await new Promise<void>(r=>reserve.listen(0,'127.0.0.1',r));const port=(reserve.address()as{port:number}).port;await new Promise<void>(r=>reserve.close(()=>r()));const origin=`http://127.0.0.1:${port}`;
 const child:ChildProcess=spawn(referenceBffExecutable(),[],{cwd:referenceBffRoot,env:{...referenceBffSourceEnv(),NODE_ENV:'test',PATH:process.env.PATH,HOME:process.env.HOME,QUANTOS_SKIP_ENV:'1',QUANTOS_BFF_MODE:'reference',QUANTOS_BFF_REFERENCE_CONTEXT:mode,QUANTOS_BFF_BIND:`127.0.0.1:${port}`},stdio:['ignore','pipe','pipe']});
 let diagnostics='';child.stderr?.on('data',b=>{diagnostics=(diagnostics+String(b)).slice(-4000);});
 try{await new Promise<void>((r,j)=>{const t=setTimeout(()=>j(Error('reference startup timeout')),15000);child.once('error',e=>{clearTimeout(t);j(e);});child.once('exit',()=>{clearTimeout(t);j(Error('reference exited: '+diagnostics));});child.stdout!.on('data',b=>{if(String(b).includes('"ready":true')){clearTimeout(t);r();}});});}catch(e){child.kill();throw e;}
 const requests:Request[]=[],rows:{method:string;path:string;status:number;bodyHash:string;keyHash?:string;responseHash:string;deliveredResponseHash?:string;source:string;referenceSession:string}[]=[];
 function transport(session='session-current',hook?:(req:Request,res:Response)=>Promise<Response>):typeof fetch{return async(input,init)=>{const req=new Request(input,init);if(new URL(req.url).origin!==origin)throw Error('External network refused');requests.push(req.clone());req.headers.set('cookie',`quantos_session=${session}; quantos_csrf=${csrf}`);req.headers.set('origin','http://localhost:3190');const bodyHash=hash(await req.clone().text()),res=await fetch(req),path=new URL(req.url).pathname;const row={method:req.method,path,status:res.status,bodyHash,keyHash:req.headers.has('idempotency-key')?hash(req.headers.get('idempotency-key')!):undefined,responseHash:hash(new Uint8Array(await res.clone().arrayBuffer())),deliveredResponseHash:undefined as string|undefined,source:'REFERENCE_BYTES',referenceSession:session};rows.push(row);try{const delivered=hook?await hook(req,res):res;row.deliveredResponseHash=delivered===res?row.responseHash:hash(new Uint8Array(await delivered.clone().arrayBuffer()));if(row.deliveredResponseHash!==row.responseHash)row.source='SYNTHETIC_RESPONSE_CORRUPTION';return delivered;}catch(e){row.source=(e as Error).message==='EXPLICIT_COMMITTED_RESPONSE_LOSS'?'EXPLICIT_COMMITTED_RESPONSE_LOSS':'TEST_TRANSPORT_FAILURE';throw e;}};}
 return{origin,transport,requests,rows,client:(session='session-current')=>createBffClient({baseUrl:origin,fetch:transport(session)}),config:(wire:typeof fetch=transport())=>({origin,fetchImpl:wire,authorize:()=>{},online:()=>true,csrf:()=>csrf,invalidate:()=>{}}),
 receipt(name:string,details:Record<string,unknown>){const dir=process.env.QUANTOS_FEP5_EVIDENCE_DIR;if(!dir)return;mkdirSync(dir,{recursive:true});writeFileSync(dir+'/'+name+'.json',JSON.stringify({schema:'quantos-fep5-reference-flow/v1',sourceCommit:process.env.GITHUB_SHA,binarySha256:hash(readFileSync(referenceBffExecutable())),mode,identity:'EXPLICIT_REFERENCE_SESSION_TRANSPORT',data:'OWNED_SYNTHETIC_REFERENCE',productionCredentialsUsed:false,...details,rows},null,2)+'\n');},
 async close(){if(child.exitCode===null){child.kill();await new Promise(r=>child.once('close',r));}}
 };
}
export const header=(version?:string)=>({'Idempotency-Key':crypto.randomUUID(),'X-CSRF-Token':csrf,'X-Request-Id':crypto.randomUUID(),...version?{'If-Match':version}:{}});
