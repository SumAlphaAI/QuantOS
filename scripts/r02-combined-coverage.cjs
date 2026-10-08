const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const out=path.resolve(process.env.QUANTOS_R02_EVIDENCE_DIR||`artifacts/r02-combined/${require('node:crypto').randomUUID()}`);
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('R02_EVIDENCE_DIRECTORY_NOT_EMPTY');fs.mkdirSync(out,{recursive:true});
const steps=[['cargo',['llvm-cov','clean','--workspace'],{}],['node',['scripts/r02-chain-check.cjs'],{QUANTOS_R02_EVIDENCE_DIR:path.join(out,'chain'),QUANTOS_R02_COVERAGE:'1'}],['node',['scripts/r02-live-check.cjs'],{QUANTOS_R02_EVIDENCE_DIR:path.join(out,'boundaries'),QUANTOS_R02_COVERAGE:'1',QUANTOS_R02_COVERAGE_CLEAN:'0'}]];
const receipt={schema:'quantos-r02-combined-coverage/v1',result:'RUNNING',steps:[]};
const save=()=>fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');save();
for(const [bin,args,env] of steps){const r=spawnSync(bin,args,{env:{...process.env,...env},stdio:'inherit'});receipt.steps.push({bin,args,exitCode:r.status});if(r.status!==0){receipt.result='FAIL';save();process.exit(1);}save();}
receipt.result='PASS_SCOPED_TARGET';save();
