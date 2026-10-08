// Bounded remote DEVELOPMENT startup patience, never a performance acceptance.
const {performance}=require('node:perf_hooks');
const budget=require('./f06-http-budget.cjs');
module.exports=async function ready(service,route,expected,{budgetMs=60000,now=()=>performance.now(),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),probe=fetch}={}){
 budgetMs=budget(String(budgetMs));const started=now(),deadline=started+budgetMs;let probes=0;
 while(now()<deadline){
  if(service.child.exitCode!==null||service.child.signalCode!=null)break;
  try{probes++;const response=await probe(`${service.base}${route}`,{signal:AbortSignal.timeout(Math.max(1,Math.min(1000,Math.ceil(deadline-now()))))});
   if(response.status===expected&&now()<=deadline&&service.child.exitCode===null&&service.child.signalCode==null){const result={status:'READY',budgetMs,elapsedMs:Math.ceil(now()-started),probes,performanceAccepted:false};service.readiness=result;return result;}
  }catch{/* only an exact successful readiness response can pass */}
  const remaining=deadline-now();if(remaining>0)await pause(Math.min(200,remaining));
 }
 throw Error(`${route} did not become ready within ${budgetMs}ms (exit=${service.child.exitCode}; ${service.diagnostic()})`);
};
