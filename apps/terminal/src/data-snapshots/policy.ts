import {bffZodSchemas,type BffComponents} from "@sumalpha/api-client";
export type Snapshot=BffComponents["schemas"]["DataSnapshot"];
export const qualityLabels:Record<Snapshot["quality"],string>={verified:"已验证",provisional:"暂定",degraded:"质量降级",failed:"质量失败",expired:"已过期",license_missing:"缺少许可"};
/** Adds conservative local checks; never overrides an owner denial or grants a business purpose. */
export function snapshotPolicy(value:unknown,now=Date.now()) {
 const parsed=bffZodSchemas.DataSnapshot.safeParse(value),reasons:string[]=[];
 if(!parsed.success)return{eligible:false,reasons:["快照契约无效或质量未知，需升级/重新读取"],expiresAt:0};
 const s=parsed.data,captured=Date.parse(s.capturedAt),start=Date.parse(s.window.start),end=Date.parse(s.window.end);
 const expiresAt=Math.min(captured,end)+s.maxAgeSeconds*1000;
 if(s.quality!=="verified")reasons.push(qualityLabels[s.quality]);
 if(s.qualityBlocked!==false)reasons.push("服务端阻断或未明确解除阻断");
 if(!s.licenseLabel.trim())reasons.push("缺少许可标签");
 if(!Number.isFinite(now)||!Number.isFinite(expiresAt)||Math.abs(expiresAt)>8.64e15||start>end||end>captured||captured>now)reasons.push("采集时间或窗口无效");
 if(now>=expiresAt)reasons.push("已超过最大允许时效");
 return{eligible:reasons.length===0,reasons,expiresAt};
}
export function snapshotLocation(path:string,search:string) {
 const p=new URLSearchParams(search),ids=p.getAll("snapshotId");
 if(ids.length>1||[...p.keys()].some(k=>k!=="snapshotId"))throw Error("快照引用无效");
 const parts=path.replace(/\/$/,"").split("/");if(parts[1]!=="data-snapshots"||parts.length>3)throw Error("快照路由无效");
 const id=parts[2]??ids[0];if(parts[2]&&ids[0]&&parts[2]!==ids[0])throw Error("快照引用冲突");
 if(id)bffZodSchemas.UUID.parse(id);return id;
}
export const snapshotPath=(id:string)=>"/data-snapshots/"+bffZodSchemas.UUID.parse(id);
