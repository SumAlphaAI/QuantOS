import {loadBffFe007Inputs,validateBffFe007} from "/Users/anray/Documents/project/SumAlpha/QuantOS/scripts/check-bff-fe-007.mjs";
import {writeFileSync} from "node:fs";
const inputs=loadBffFe007Inputs();
const dummy=["search_audit_events","get_evidence_chain","create_export","cancel_export","get_export_download","downloads.invalid","audit:export","[REDACTED]"].map(x=>"// "+x).join("\n");
const cases=[{id:"comments_only_provider",result:validateBffFe007({...inputs,provider:dummy})},{id:"unassessed_dependency",result:validateBffFe007({...inputs,frontendPlan:inputs.frontendPlan.replace(/(- task_id: `BFF-FE-001`[\s\S]*?- stage_gate: )[^\n]+/,"$1{\"stage\":\"DEVELOPMENT\",\"status\":\"NOT_ASSESSED\",\"input_digest\":null,\"evidence\":[]}")})}];
if(cases.some(x=>x.result.status!=="PASS"))throw Error("probe observation changed");
writeFileSync("docs/audit/evidence/bff-fe-007-review-20261006/gate-mutations.json",JSON.stringify({sourceCommit:"ce4907cd819cdca30cba2a59f66cc51dc30fffda",modifiedRepositoryFiles:false,cases},null,2)+"\n");console.log(JSON.stringify(cases));
