// An audit scope identifies only this assessment's fixture Engine processes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {snapshot,newlyOwned,stopOwned}=require('./lib/test-engine-processes.cjs');
const root=path.resolve(__dirname,'..'),output=process.argv[2];
assert(output&&process.env.QUANTOS_R1_ENGINE_BASELINE,'assessment baseline and new output are required');
assert(!fs.existsSync(output),'process cleanup receipt already exists');
const baseline=JSON.parse(fs.readFileSync(process.env.QUANTOS_R1_ENGINE_BASELINE));
assert(/^[a-f0-9]{8}$/.test(baseline.scopeTag),'missing bounded assessment scope');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const r={schema:'quantos-r1-process-cleanup/v1',sourceCommit,scopeTag:baseline.scopeTag,baselineCapturedAt:baseline.capturedAt,checkedAt:new Date().toISOString(),platform:process.platform,processCheckingExecuted:true,status:'RUNNING',formalAccepted:false};
(async()=>{try{r.discovered=newlyOwned(baseline,snapshot(root));r.remaining=r.discovered.length?await stopOwned(r.discovered,root):[];r.status=r.discovered.length===0?'PASS':'FAIL';}catch(e){r.status='FAIL';r.failure=e.code??'PROCESS_CLEANUP_FAILED';}finally{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(r,null,2)+'\n');if(r.status!=='PASS')process.exitCode=1;console.log('R1_PROCESS_CLEANUP '+r.status);}})();
