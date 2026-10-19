import {createBffClient,bffZodSchemas,SseStreamReducer,type BffComponents,type SseEventEnvelope} from "@sumalpha/api-client";
export const strategyClient=(origin:string,transport:typeof fetch=fetch)=>createBffClient({baseUrl:origin,fetch:transport,timeoutMs:10000});
type Draft=BffComponents["schemas"]["StrategyDraft"];
type DraftSave=Pick<Draft,"strategyId"|"files"|"parameters">&{expectedVersion:string;editRevision:number};
/** A conflict retains local edits. Refreshing server state never submits them. */
export class DraftBuffer {
 private remote:Draft;
 private local:Pick<Draft,"files"|"parameters">;
 private editRevision=0;
 constructor(raw:unknown){this.remote=bffZodSchemas.StrategyDraft.parse(raw);this.local={files:structuredClone(this.remote.files),parameters:structuredClone(this.remote.parameters)};}
 get expectedVersion(){return this.remote.objectVersion;}
 get pending(){return structuredClone(this.local);}
 edit(files:Draft["files"],parameters:Draft["parameters"]){this.local={files:structuredClone(files),parameters:structuredClone(parameters)};this.editRevision++;}
 /** Capture the exact edit submitted before an asynchronous save starts. */
 captureSave():DraftSave{return{strategyId:this.remote.strategyId,expectedVersion:this.expectedVersion,editRevision:this.editRevision,...this.pending};}
 conflict(raw:unknown){const error=bffZodSchemas.ErrorEnvelope.parse(raw);if(error.code!=="VERSION_CONFLICT"||!error.currentVersion)throw Error("Version conflict required");return {currentVersion:error.currentVersion,diff:error.conflictDiff};}
 /** Explicit resolution after the user merges local changes against a fetched head. */
 resolve(raw:unknown,files:Draft["files"],parameters:Draft["parameters"]){const head=bffZodSchemas.StrategyDraft.parse(raw);if(head.strategyId!==this.remote.strategyId)throw Error("Strategy mismatch");if(BigInt(head.objectVersion)<BigInt(this.expectedVersion))throw Error("Stale strategy version");this.remote=head;this.edit(files,parameters);}
 saved(raw:unknown,submitted:DraftSave){const head=bffZodSchemas.StrategyDraft.parse(raw);if(head.strategyId!==this.remote.strategyId||submitted.strategyId!==this.remote.strategyId)throw Error("Strategy mismatch");if(BigInt(head.objectVersion)<BigInt(this.expectedVersion))throw Error("Stale strategy version");if(BigInt(head.objectVersion)!==BigInt(submitted.expectedVersion)+1n)throw Error("Save version mismatch");this.remote=head;if(this.editRevision===submitted.editRevision)this.local={files:structuredClone(head.files),parameters:structuredClone(head.parameters)};}
}
/** A 202 receipt is never a completed or validated backtest report. */
export class BacktestFacts {
 private reducer=new SseStreamReducer();private stream?:string;private value?:BffComponents["schemas"]["BacktestReport"];
 constructor(readonly runId:string,readonly strategyId:string){bffZodSchemas.UUID.parse(runId);bffZodSchemas.UUID.parse(strategyId);}
 get snapshot(){return this.value&&structuredClone(this.value);}
 get afterSequence(){return this.reducer.resumeAfter;}
 accepted(raw:unknown){bffZodSchemas.AsyncAccepted.parse(raw);}
 revoke(){this.reducer.close();this.value=undefined;}
 apply(raw:SseEventEnvelope){if(this.reducer.isClosed)throw Error("Backtest permission revoked");const e=bffZodSchemas.StreamEvent.parse(raw);if(e.payload.type==="permission_revoked"){this.revoke();return "revoked";}if(this.stream&&this.stream!==e.streamId)throw Error("Backtest lease changed");const r=bffZodSchemas.BacktestReport.parse(e.payload);if(r.runId!==this.runId||r.strategyId!==this.strategyId)throw Error("Backtest resource mismatch");const action=this.reducer.accept(raw);if(action.type==="gap")throw Error("Backtest gap; replay required");if(action.type!=="apply")return "ignored";this.value=structuredClone(r);this.stream=e.streamId;return "applied";}
 url(origin:string){const url=new URL(`/v1/backtests/${encodeURIComponent(this.runId)}/stream`,origin);url.searchParams.set("afterSequence",String(this.afterSequence));return url.toString();}
}
export function localReleaseTargets(raw:unknown,now=Date.now()){const release=bffZodSchemas.StrategyRelease.parse(raw);if(release.approvalState!=="approved"||!release.expiresAt||Date.parse(release.expiresAt)<=now||release.allowedTargets.some(t=>t!=="paper"&&t!=="shadow"))throw Error("Approved Paper/Shadow release required");return [...release.allowedTargets];}
