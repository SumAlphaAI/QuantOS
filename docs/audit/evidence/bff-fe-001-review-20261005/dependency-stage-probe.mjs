import {loadBffFe001Inputs,validateBffFe001} from '../../../../scripts/check-bff-fe-001.mjs';
import {writeFileSync} from 'node:fs';
const current=loadBffFe001Inputs();
const baseline=validateBffFe001(current);
const plan=current.frontendPlan.replace(/(- task_id: `BFF-FE-000`[\s\S]*?- stage_gate: )[^\n]+/,'$1{"stage":"DEVELOPMENT","status":"NOT_ASSESSED","input_digest":null,"evidence":[]}');
if(plan===current.frontendPlan)throw Error('probe did not match');
const result=validateBffFe001({...current,frontendPlan:plan});
const report={scope:'in-memory validator input only; actual plan unchanged',baseline,dependencyStageReset:'FE:BFF-FE-000 NOT_ASSESSED; historical COMPLETED retained',result};
writeFileSync(new URL('dependency-stage-probe.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
