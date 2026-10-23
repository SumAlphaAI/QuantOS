import {bffZodSchemas} from "@sumalpha/api-client";
import type {ResearchRun} from "./policy";
export function researchLocation(path:string,search=""){
 const parts=path.split("/"),q=new URLSearchParams(search),values=q.getAll("runId");
 if(parts[1]!=="research"||parts.length>3||values.length>1)throw Error("Invalid research route");
 const id=parts[2]&&parts[2]!=="new"?parts[2]:values[0];
 if(parts[2]==="new"&&values.length||parts[2]&&parts[2]!=="new"&&values.length)throw Error("Ambiguous research route");
 return id?bffZodSchemas.UUID.parse(id).toLowerCase():undefined;
}
export const researchPath=(id:string)=>"/research/"+bffZodSchemas.UUID.parse(id).toLowerCase();
export const terminalResearch=(run:ResearchRun)=>["succeeded","failed","cancelled"].includes(run.status);
export function assertSameResearch(before:ResearchRun|undefined,after:ResearchRun){
 if(!before)return;
 for(const k of ["runId","capability","dataSnapshotId","budget","deadlineAt","inputHash","correlationId","createdAt"] as const)if(before[k]!==after[k])throw Error("Research identity changed");
 if(terminalResearch(before)&&before.status!==after.status)throw Error("Research terminal status changed");
}
