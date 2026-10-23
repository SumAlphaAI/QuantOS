import {bffZodSchemas,type BffComponents} from "@sumalpha/api-client";
const uuid=(value:string)=>bffZodSchemas.UUID.parse(value).toLowerCase();
const hash=/^sha256:[a-f0-9]{64}$/;
export type ArtifactLocation={artifactId?:string;runId?:string;evidenceId?:string};
export type ArtifactEvidence={evidenceId:string;artifactId:string;summary:string};
export type ArtifactDetail=BffComponents["schemas"]["Artifact"]&{correlationId?:string;inputHash?:string;evidence:ArtifactEvidence[];evidenceProvided:boolean};
export function artifactLocation(path:string,search=""):ArtifactLocation{
 const parts=path.split("/"),q=new URLSearchParams(search),allowed=["artifactId","runId","evidenceId"];
 if(parts[0]!==""||parts[1]!=="artifacts"||parts.length>3||[...q.keys()].some(k=>!allowed.includes(k))||allowed.some(k=>q.getAll(k).length>1)||parts[2]!==undefined&&q.has("artifactId"))throw Error("Invalid artifact route");
 const result={artifactId:parts[2]!==undefined?uuid(parts[2]):q.has("artifactId")?uuid(q.get("artifactId")!):undefined,runId:q.has("runId")?uuid(q.get("runId")!):undefined,evidenceId:q.has("evidenceId")?uuid(q.get("evidenceId")!):undefined};
 if(!result.artifactId&&(result.runId||result.evidenceId)&&!(result.runId&&result.evidenceId))throw Error("Artifact or scoped evidence reference required");return result;
}
export function artifactPath(id:string,scope:Omit<ArtifactLocation,"artifactId">={}){const q=new URLSearchParams();if(scope.runId)q.set("runId",uuid(scope.runId));if(scope.evidenceId)q.set("evidenceId",uuid(scope.evidenceId));return "/artifacts/"+uuid(id)+(q.size?"?"+q:"");}
export function evidencePath(runId:string,evidenceId:string){return"/artifacts?"+new URLSearchParams({runId:uuid(runId),evidenceId:uuid(evidenceId)});}
export function parseArtifact(value:unknown):ArtifactDetail{
 const a=bffZodSchemas.Artifact.parse(value),raw=a as Record<string,unknown>;
 if(a.hypothesis.length>16000||a.summary.length>32000||[a.engineVersion,a.promptVersion,a.codeVersion].some(v=>v.length>512)||(a.lineageRefs?.length??0)>200)throw Error("Artifact bounds exceeded");
 const correlationId=raw.correlationId===undefined?undefined:uuid(raw.correlationId as string),inputHash=raw.inputHash===undefined?undefined:String(raw.inputHash);
 if(inputHash!==undefined&&!hash.test(inputHash))throw Error("Invalid artifact input hash");
 const evidenceProvided=raw.evidence!==undefined,evidence=raw.evidence===undefined?[]:raw.evidence;
 if(!Array.isArray(evidence)||evidence.length>200)throw Error("Invalid artifact evidence");
 const parsed=evidence.map((e:unknown)=>{if(!e||typeof e!=="object")throw Error("Invalid evidence");const r=e as Record<string,unknown>;if(typeof r.summary!=="string"||r.summary.length>16000||uuid(String(r.artifactId))!==a.artifactId.toLowerCase())throw Error("Evidence resource mismatch");return{evidenceId:uuid(String(r.evidenceId)),artifactId:uuid(String(r.artifactId)),summary:r.summary};});
 if(new Set(parsed.map(e=>e.evidenceId)).size!==parsed.length)throw Error("Duplicate evidence identity");
 return{...a,artifactId:uuid(a.artifactId),dataSnapshotId:uuid(a.dataSnapshotId),correlationId,inputHash,evidence:parsed,evidenceProvided};
}
export function auditObjectPath(node:{kind:string;objectRef:string}){
 if(!bffZodSchemas.UUID.safeParse(node.objectRef).success)return undefined;
 if(node.kind==="research.artifact.read")return artifactPath(node.objectRef);
 if(["research.create","research.cancel"].includes(node.kind))return"/research/"+uuid(node.objectRef);
 return undefined;
}
