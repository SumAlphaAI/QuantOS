import type {ResearchQuery} from "./gateway";
import {researchCapabilities,validateResearchQuery,type ResearchRun,type ResearchForm} from "./policy";
export const capabilityLabels:Record<typeof researchCapabilities[number],string>={"research.hypothesis.v1":"研究假设","research.experiment.v1":"研究实验"};
export const researchTone=(status:ResearchRun["status"])=>status==="succeeded"?"good":status==="failed"?"bad":status==="running"?"active":status==="cancel_requested"?"warn":"muted";
export const shortResearchRef=(id:string)=>id.length>18?`${id.slice(0,8)}…${id.slice(-6)}`:id;
export function researchUtc(value:string){const n=Date.parse(value);return Number.isFinite(n)?new Date(n).toISOString().replace('T',' ').replace('.000Z',' UTC'):"无效时间";}
/** Current page only; no invented global count, progress or cost fallback. */
export function researchPageSummary(items:readonly ResearchRun[]){return{loaded:items.length,running:items.filter(r=>r.status==="running").length,failed:items.filter(r=>r.status==="failed").length,succeeded:items.filter(r=>r.status==="succeeded").length};}
export function researchListQuery(input:{status:string;snapshotId:string;sort:string;pageSize:number;searchField:"runId"|"correlationId";searchValue:string}):ResearchQuery{
 const q:ResearchQuery={status:input.status?input.status as ResearchRun["status"]:undefined,dataSnapshotId:input.snapshotId||undefined,sort:input.sort,pageSize:input.pageSize,filter:input.searchValue?`${input.searchField}:eq:${input.searchValue}`:undefined};validateResearchQuery(q);return q;
}
export function researchReview(form:ResearchForm){return{capability:capabilityLabels[form.capability as keyof typeof capabilityLabels]??"未知能力",snapshotId:form.dataSnapshotId||"尚未选择",budget:form.budget,deadlineAt:researchUtc(form.deadlineAt),scope:"RESEARCH_CREATE_ONLY_NOT_ORDER_OR_PURPOSE_AUTHORIZATION" as const};}
