// Semantic scenario coverage survives suite growth without accepting a narrowed run.
const assert=require('node:assert/strict');
const required=[
 'signal_proposal_workflow_runs_hundred_cases_with_evidence_expiry_and_non_executable_proposals',
 'signal_proposal_workflow_replay_keeps_signal_and_proposal_hashes_stable',
 'signal_proposal_workflow_rejects_forbidden_order_tools',
 'r04_consumes_r03_artifact_with_bound_provenance_and_rejects_invalid_references',
];
function validateSignalProposalOutput(output){
 for(const name of required)assert(output.includes('test '+name+' ... ok'),'missing successful R04 scenario: '+name);
 const summaries=[...output.matchAll(/test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored;/g)];
 assert(summaries.some(m=>Number(m[1])>=required.length&&m[2]==='0'&&m[3]==='0'),'complete R04 pass-only summary missing');
 assert(!/test result: FAILED|\.\.\. FAILED|\b[1-9]\d* failed;/.test(output),'failed R04 execution');
 return true;
}
module.exports={required,validateSignalProposalOutput};
