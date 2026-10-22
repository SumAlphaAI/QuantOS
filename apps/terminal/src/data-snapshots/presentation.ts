import {bffZodSchemas} from "@sumalpha/api-client";
import {snapshotPolicy,type Snapshot} from "./policy";
export const shortSnapshot=(id:string)=>id.length>24?`${id.slice(0,8)}…${id.slice(-8)}`:id;
export function snapshotUtc(value:string){const n=Date.parse(value);return Number.isFinite(n)?new Date(n).toISOString().replace("T"," ").replace(/\.\d{3}Z$/," UTC"):"时间无效";}
export function snapshotTone(s:Snapshot,now=Date.now()) {return snapshotPolicy(s,now).eligible?"good":s.quality==="failed"||s.quality==="license_missing"?"bad":"warn";}
export function snapshotPageSummary(items:Snapshot[],now=Date.now()) {return{loaded:items.length,eligible:items.filter(s=>snapshotPolicy(s,now).eligible).length,blocked:items.filter(s=>!snapshotPolicy(s,now).eligible).length,failed:items.filter(s=>s.quality==="failed").length};}
/** Export only documented C04 fields, never arbitrary passthrough data or credentials. */
export function snapshotMetadata(value:unknown) {
 const s=bffZodSchemas.DataSnapshot.parse(value);
 return{snapshotId:s.snapshotId,schemaVersion:s.schemaVersion,window:{start:s.window.start,end:s.window.end},sources:[...s.sources],quality:s.quality,qualityBlocked:s.qualityBlocked,contentHash:s.contentHash,licenseLabel:s.licenseLabel,capturedAt:s.capturedAt,maxAgeSeconds:s.maxAgeSeconds,...(s.auditRef?{auditRef:s.auditRef}:{})};
}
export function comparisonSelection(previous:string[],id:string) {
 bffZodSchemas.UUID.parse(id);const selected=[...new Set(previous)];if(selected.includes(id))return selected.filter(v=>v!==id);if(selected.length>=2)throw Error("最多选择两个快照进行比较。");return[...selected,id];
}
