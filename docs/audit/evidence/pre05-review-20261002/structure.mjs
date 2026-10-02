import {readFileSync,writeFileSync} from 'node:fs';
import {parse} from 'yaml';
import {validateEnv} from '../../../../packages/config/src/env.ts';
const workflows=['ci.yml','frontend-baseline.yml','compatibility.yml','visual-baseline-candidates.yml'];
const rows=[];
for(const file of workflows){const doc=parse(readFileSync('.github/workflows/'+file,'utf8'));for(const [name,job]of Object.entries(doc.jobs)){if(job.env?.NEXT_PUBLIC_QUANTOS_ENV){const result=validateEnv(job.env);rows.push({file,job:name,profile:job.env.NEXT_PUBLIC_QUANTOS_ENV,config_ok:result.ok,keys:Object.keys(job.env).filter(key=>key.startsWith('NEXT_PUBLIC_')),issues:result.issues});}}}
const baseline=parse(readFileSync('.github/workflows/frontend-baseline.yml','utf8'));
const hook=Object.values(baseline.jobs).some(job=>job.steps.some(step=>step.run?.includes('pnpm check:pre05 && pnpm test:pre05')));
const result={workflow_yaml:'PASS',jobs:rows,pre05_positive_and_test_hook:hook,current_g0_review_status:JSON.parse(readFileSync('docs/gate-records/G0-current-governance.json','utf8')).currentCheckpoint.review_status};
if(!hook||rows.some(row=>!row.config_ok))throw Error('unexpected structural failure');
writeFileSync(new URL('structure.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({jobs:rows.length,hook,g0:result.current_g0_review_status}));
