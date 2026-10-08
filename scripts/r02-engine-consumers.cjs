// Preserve all five static consumer scenarios and terminate only this command's group.
const {executeTarget}=require('./lib/development-target-command.cjs');
const controller=new AbortController();
const stop=()=>controller.abort();process.on('SIGTERM',stop);process.on('SIGINT',stop);
(async()=>{
 try{
  const {output,...diagnostics}=await executeTarget('cargo',['test','-p','quantos-runtime','--locked','--test','research_orchestration','--test','signal_proposal_orchestration','--','--skip','r02_retained_market_persistent_research_chain'],{timeoutMs:840000,abortSignal:controller.signal,onStart:progress=>console.log('R02_ENGINE_CONSUMERS_START '+JSON.stringify(progress))});
  process.stdout.write(output);console.log('R02_ENGINE_CONSUMERS_DIAGNOSTIC '+JSON.stringify(diagnostics));
  const passed=diagnostics.exitCode===0&&/test result: ok\. 2 passed; 0 failed/.test(output)&&/test result: ok\. 3 passed; 0 failed/.test(output);
  console.log('R02_ENGINE_CONSUMERS '+(passed?'PASS':'FAIL'));if(!passed)process.exitCode=1;
 }catch(e){console.log('R02_ENGINE_CONSUMERS FAIL '+(e.code||'COMMAND_FAILED'));process.exitCode=1;}
 finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
})();
