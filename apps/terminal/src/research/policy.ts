import {bffZodSchemas,type BffComponents} from "@sumalpha/api-client";
import type {ResearchInput,ResearchQuery} from "./gateway";
export type ResearchRun=BffComponents["schemas"]["ResearchRun"];
export type ResearchForm={capability:string;dataSnapshotId:string;question:string;budget:string;deadlineAt:string};
export const researchCapabilities=["research.hypothesis.v1","research.experiment.v1"] as const;
export const researchStatuses=["queued","running","succeeded","failed","cancelled","cancel_requested"] as const;
export const statusLabels:Record<ResearchRun["status"],string>={queued:"排队中",running:"运行中",succeeded:"已完成",failed:"失败",cancelled:"已取消",cancel_requested:"已请求取消"};
/** Matches provider bounds without converting budget to floating point. UTC only. */
export function validateResearchForm(form:ResearchForm,now=Date.now()) {
 const errors:Record<string,string>={};
 if(!researchCapabilities.includes(form.capability as ResearchInput["capability"]))errors.capability="请选择受支持的研究能力。";
 if(!bffZodSchemas.UUID.safeParse(form.dataSnapshotId).success)errors.dataSnapshotId="请选择有效快照引用。";
 if(!form.question.trim()||new TextEncoder().encode(form.question).length>8000)errors.question="研究问题须为 1–8000 UTF-8 字节，不能全为空白。";
 if(!/^[1-9][0-9]{0,6}$/.test(form.budget)||BigInt(form.budget)>1000000n)errors.budget="预算须为 1–1000000 的整数成本单位。";
 const deadline=Date.parse(form.deadlineAt);
 if(!Number.isFinite(now)||!bffZodSchemas.DateTime.safeParse(form.deadlineAt).success||!form.deadlineAt.endsWith("Z")||deadline<=now||deadline>now+86400000)errors.deadlineAt="请输入未来 24 小时内的 UTC 时间（以 Z 结尾）。";
 const body:ResearchInput={capability:form.capability as ResearchInput["capability"],dataSnapshotId:form.dataSnapshotId,question:form.question,budget:form.budget,deadlineAt:form.deadlineAt};
 return {errors,body,valid:Object.keys(errors).length===0};
}
export function validateResearchQuery(q:ResearchQuery){
 if(!Number.isInteger(q.pageSize??25)||(q.pageSize??25)<1||(q.pageSize??25)>200)throw Error("Invalid page size");
 if(q.status&&!researchStatuses.includes(q.status))throw Error("Invalid status");
 if(q.dataSnapshotId)bffZodSchemas.UUID.parse(q.dataSnapshotId);
 if(q.sort&&!/^(runId|dataSnapshotId|deadlineAt|status|correlationId|createdAt):(asc|desc)$/.test(q.sort))throw Error("Invalid sort");
 if(q.filter){const m=q.filter.match(/^(runId|dataSnapshotId|status|correlationId):eq:(.+)$/);if(!m)throw Error("Invalid filter");if(m[1]==="status"){if(!researchStatuses.includes(m[2] as ResearchRun["status"]))throw Error("Invalid status");}else bffZodSchemas.UUID.parse(m[2]);}
}
