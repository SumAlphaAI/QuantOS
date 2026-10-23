import {z} from "zod";
import {bffZodSchemas,SseStreamReducer,SseContractError,type SseEventEnvelope} from "@sumalpha/api-client";
const hash=z.string().regex(/^sha256:[a-f0-9]{64}$/),version=z.string().regex(/^(0|[1-9]\d*)$/),finite=z.number().finite();
export const reportSchema=bffZodSchemas.BacktestReport.extend({objectVersion:version,reportHash:hash,executionInputs:z.object({costModel:z.object({fee_bps:z.number().int().min(0).max(10000),slippage_bps:z.number().int().min(0).max(9999)})}),report:z.object({snapshot_id:bffZodSchemas.UUID,candidate:z.object({source_commit:z.string().regex(/^[a-f0-9]{40}$/),image_digest:hash,runtime_digest:hash,clock:z.string().datetime({offset:true})}),draft:z.object({draft_id:bffZodSchemas.UUID,version:z.number().int().nonnegative().safe(),version_hash:hash,parameter_hash:hash}),parameter_hash:hash,input_hash:hash,environment_hash:hash,report_hash:hash,costs:z.object({fees_total:finite,slippage_total:finite}),leak_check:z.object({decisions:z.number().int().nonnegative(),violations:z.number().int().nonnegative()})}).passthrough()});
export type BacktestReport=z.infer<typeof reportSchema>;
export const terminalBacktest=(status:string)=>["succeeded","failed","cancelled"].includes(status);
export function checkedReport(raw:unknown,runId:string,baseline?:BacktestReport){
 const envelope=bffZodSchemas.BacktestReport.parse(raw);if(envelope.runId!==runId)throw Error("Backtest resource mismatch");
 // Pending/failed reports may lack an artifact. They never qualify for release readiness.
 if(envelope.status!=="succeeded"){if(baseline)throw Error("Terminal report changed");return envelope;}
 const r=reportSchema.parse(envelope),p=r.report;
 if(p.snapshot_id!==r.dataSnapshotId||p.draft.draft_id!==r.strategyId||String(p.draft.version)!==r.objectVersion||p.parameter_hash!==p.draft.parameter_hash||p.report_hash!==r.reportHash)throw Error("Backtest binding mismatch");
 if(baseline&&JSON.stringify([r.strategyId,r.objectVersion,r.dataSnapshotId,r.reportHash,r.executionInputs,r.report,r.metrics,r.leakViolations,r.reportArtifactId])!==JSON.stringify([baseline.strategyId,baseline.objectVersion,baseline.dataSnapshotId,baseline.reportHash,baseline.executionInputs,baseline.report,baseline.metrics,baseline.leakViolations,baseline.reportArtifactId]))throw Error("Immutable report changed");return r;
}
export function releaseReadiness(raw:unknown,currentVersion?:string){try{const r=reportSchema.parse(raw);checkedReport(r,r.runId);if(r.status!=="succeeded"||r.leakViolations.length||r.report.leak_check.violations!==0)return {ready:false,reason:"泄漏检查失败或任务未成功，阻断 Release"};if(currentVersion!==undefined&&r.objectVersion!==currentVersion)return {ready:false,reason:"报告对应旧草稿版本，须重新检查与回测"};return {ready:true,reason:"回测证据完整；Release 与审批仍由 UI-303 接入"};}catch{return {ready:false,reason:"报告或固定输入绑定不完整，阻断 Release"};}}
export function backtestLocation(pathname:string,search=""){const match=/^\/backtests\/([^/]+)$/.exec(pathname);if(!match||search)throw Error("Invalid backtest route");return bffZodSchemas.UUID.parse(match[1]).toLowerCase();}
export class BacktestReducer extends SseStreamReducer{
 private stream?:string;
 constructor(readonly runId:string,readonly strategyId:string,readonly baseline?:BacktestReport){super();}
 override accept(event:SseEventEnvelope){const e=bffZodSchemas.StreamEvent.parse(event);if(e.payload.type==="permission_revoked")return this.close();if(this.stream&&this.stream!==e.streamId)throw new SseContractError("Backtest stream changed");let r;try{r=checkedReport(e.payload,this.runId,this.baseline);}catch{throw new SseContractError("Backtest event facts rejected");}if(r.runId!==this.runId||r.strategyId!==this.strategyId||e.sequence>2000)throw new SseContractError("Backtest event binding rejected");const action=super.accept(event);if(action.type==="apply")this.stream=e.streamId;return action;}
}
