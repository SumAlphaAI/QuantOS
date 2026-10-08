// Only initial pg connection establishment is retryable. No query or write runs here.
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const transportCodes=new Set(['ECONNRESET','ETIMEDOUT','EPIPE','EAI_AGAIN']);
function classification(error){
 if(error?.name==='AbortError')return {transient:false,errorKind:'CANCELLED'};
 if(typeof error?.code==='string'&&/^[0-9A-Z]{5}$/.test(error.code))return {transient:['08003','08006'].includes(error.code),errorKind:'POSTGRES_'+error.code};
 if(transportCodes.has(error?.code))return {transient:true,errorKind:error.code};
 if(error?.message==='Connection terminated unexpectedly')return {transient:true,errorKind:'CONNECTION_TERMINATED'};
 if(error?.message==='timeout expired')return {transient:true,errorKind:'CONNECT_TIMEOUT'};
 return {transient:false,errorKind:'NON_TRANSIENT'};
}
async function connectBeforeStatements(createClient,{record,maxAttempts=3,onAttempt=()=>{},pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 assert(record&&typeof createClient==='function','bootstrap factory and evidence record required');
 assert(Number.isInteger(maxAttempts)&&maxAttempts>=1&&maxAttempts<=3,'bootstrap attempt budget must be between 1 and 3');
 Object.assign(record,{schema:'quantos-postgres-bootstrap/v1',phase:'BEFORE_STATEMENTS',maxAttempts,status:'RUNNING',attempts:[]});
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  const client=createClient(),started=performance.now();
  try{await client.connect();}
  catch(error){const c=classification(error);const outcome={attempt,status:'FAIL',...c,elapsedMs:performance.now()-started,connectionClosed:false};
   record.attempts.push(outcome);try{await client.end();outcome.connectionClosed=true;}catch{outcome.cleanupFailed=true;}
   record.status='FAIL';onAttempt();
   if(!c.transient||!outcome.connectionClosed||attempt===maxAttempts)throw error;
   await pause(250);continue;
  }
  record.attempts.push({attempt,status:'PASS',transient:false,elapsedMs:performance.now()-started});record.status='PASS';
  try{onAttempt();}catch(error){await client.end().catch(()=>{});throw error;}
  return client;
 }
}
function validateBootstrap(record){
 assert.equal(record?.schema,'quantos-postgres-bootstrap/v1');assert.equal(record.phase,'BEFORE_STATEMENTS');assert.equal(record.status,'PASS');
 assert(Number.isInteger(record.maxAttempts)&&record.maxAttempts>=1&&record.maxAttempts<=3);assert(Array.isArray(record.attempts)&&record.attempts.length>=1&&record.attempts.length<=record.maxAttempts);
 for(const [i,a]of record.attempts.entries()){
  assert.equal(a.attempt,i+1);assert(Number.isFinite(a.elapsedMs)&&a.elapsedMs>=0);
  if(i===record.attempts.length-1){assert.equal(a.status,'PASS');assert.equal(a.transient,false);assert.equal(a.errorKind,undefined);assert.equal(a.cleanupFailed,undefined);}
  else{assert.equal(a.status,'FAIL');assert.equal(a.transient,true);assert.equal(a.connectionClosed,true);assert(!a.cleanupFailed);assert(['CONNECTION_TERMINATED','CONNECT_TIMEOUT','POSTGRES_08003','POSTGRES_08006',...transportCodes].includes(a.errorKind),'semantic bootstrap failure cannot be retried');}
 }
}
module.exports={connectBeforeStatements,validateBootstrap};
