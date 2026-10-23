import {afterEach,expect,it} from "vitest";
import {closureModel,ids} from "./fep2-fixture";
import {snapshotPolicy} from "../src/data-snapshots/policy";
import {artifactLocation,evidencePath,auditObjectPath} from "../src/artifacts/policy";
const models:ReturnType<typeof closureModel>[]=[];
const setup=()=>{const m=closureModel();models.push(m);return m;};
afterEach(()=>{for(const m of models.splice(0))m.close();});
const writes=(m:ReturnType<typeof setup>)=>m.requests.filter(r=>r.method==="POST");
async function start(m:ReturnType<typeof setup>){await m.research.load();await m.research.create(m.form);await m.detail.load();await m.detail.refresh();await expect.poll(()=>m.activeStreams).toBe(1);}
it("composes Snapshot → create/list → SSE/C03 → Artifact/Evidence → C10 using actual frontend runtimes and one explicit model",async()=>{
 const m=setup();await m.snapshots.load();const page=await m.snapshots.list();expect(page.items[0].snapshotId).toBe(ids.snapshot);
 const snapshot=await m.snapshots.detail(ids.snapshot);expect(snapshotPolicy(snapshot,Date.parse("2026-10-23T00:00:00Z")).eligible).toBe(true);
 await m.research.load();expect((await m.research.list()).items).toEqual([]);expect((await m.research.snapshots()).items[0].contentHash).toBe(snapshot.contentHash);
 const accepted=await m.research.create(m.form);expect(accepted.jobId).toBe(ids.run);expect(accepted.correlationId).toBe(ids.correlation);expect((await m.research.list()).items[0].dataSnapshotId).toBe(snapshot.snapshotId);
 await m.detail.load();await m.detail.refresh();await expect.poll(()=>m.activeStreams).toBe(1);
 m.finish();m.emit(1);await expect.poll(()=>m.detail.view.run?.status).toBe("succeeded");await expect.poll(()=>m.activeStreams).toBe(0);
 const link=new URL(evidencePath(ids.run,ids.evidence),"https://fixture.invalid"),location=artifactLocation(link.pathname,link.search);
 await m.artifacts.load();const view=await m.artifacts.detail(location);
 expect(view.artifact.artifactId).toBe(m.detail.view.run?.artifactRefs?.[0]);expect(view.evidence?.evidenceId).toBe(m.detail.view.run?.evidenceRefs[0]);expect(view.inputHash).toBe(m.detail.view.run?.inputHash);
 const chain=await m.artifacts.evidenceChain(accepted.correlationId!);expect(chain.items[1].causationId).toBe(chain.items[0].eventId);expect(auditObjectPath(chain.items[1])).toBe("/artifacts/"+ids.artifact);
 expect((await m.artifacts.attachment()).contentHash).toBe(view.artifact.contentHash);expect(m.createCommits).toBe(1);expect(writes(m)).toHaveLength(1);expect(m.requests.filter(r=>r.method==="GET").every(r=>r.cache==="no-store")).toBe(true);
});
it.each(["quality","license","freshness"])("rechecks %s after snapshot selection and refuses create before dispatch",async kind=>{
 const m=setup();await m.research.load();await m.research.snapshots();if(kind==="quality")m.snapshot.qualityBlocked=true;if(kind==="license")m.snapshot.licenseLabel=" ";if(kind==="freshness")m.advance(3540000);
 await expect(m.research.create(m.form)).rejects.toMatchObject({status:422});expect(writes(m)).toHaveLength(0);
});
it("lost create response keeps one input/key; refresh is read only and only explicit retry repeats",async()=>{
 const m=setup();await m.research.load();m.loseCreate();await expect(m.research.create(m.form)).rejects.toThrow();expect(m.research.uncertain).toBe(true);
 expect((await m.research.list()).items).toHaveLength(1);await expect(m.research.create({...m.form,question:"changed intent"})).rejects.toMatchObject({status:409});expect(writes(m)).toHaveLength(1);
 await m.research.create(m.form);expect(m.research.uncertain).toBe(false);expect(m.createCommits).toBe(1);expect(m.createBodies[0]).toBe(m.createBodies[1]);expect(writes(m)[0].headers.get("idempotency-key")).toBe(writes(m)[1].headers.get("idempotency-key"));
});
it("lost cancellation response retains original key without auto replay; terminal status remains C03 authoritative",async()=>{
 const m=setup();await start(m);m.loseCancel();await expect(m.detail.cancel()).rejects.toThrow();expect(m.detail.view.uncertain).toBe(true);await m.detail.refresh();expect(writes(m)).toHaveLength(2);expect(m.activeStreams).toBe(0);
 await m.detail.cancel();expect(m.detail.view.receipt?.status).toBe("cancel_requested");expect(m.detail.view.run?.status).toBe("queued");expect(m.cancelCommits).toBe(1);expect(writes(m)[1].headers.get("idempotency-key")).toBe(writes(m)[2].headers.get("idempotency-key"));
 m.run.status="cancelled";await m.detail.refresh();expect(m.detail.view.stream).toBe("complete");expect(m.detail.view.run?.status).toBe("cancelled");await expect.poll(()=>m.activeStreams).toBe(0);
});
it("explicit stream recovery resumes only acknowledged sequence and does not repeat writes",async()=>{
 const m=setup();await start(m);m.emit(1);await expect.poll(()=>m.detail.view.sequence).toBe(1);await m.detail.refresh();await expect.poll(()=>m.activeStreams).toBe(1);
 const streams=m.requests.filter(r=>r.url.includes("/stream"));expect(new URL(streams.at(-1)!.url).searchParams.get("afterSequence")).toBe("1");m.emit(1);m.emit(2);await expect.poll(()=>m.detail.view.sequence).toBe(2);expect(m.detail.view.events.map(e=>e.sequence)).toEqual([1,2]);expect(writes(m)).toHaveLength(1);
});
it.each(["offline","revoked","expired","csrf"])("%s prevents writes across the composed create/detail lifecycle",async kind=>{
 const m=setup();await start(m);if(kind==="offline")m.offline();if(kind==="revoked")m.revoke();if(kind==="expired")m.advance(86400000);if(kind==="csrf")m.noCsrf();
 await expect(m.research.create(m.form)).rejects.toThrow();await expect(m.detail.cancel()).rejects.toThrow();expect(writes(m)).toHaveLength(1);
});
it.each(["membership","hash"])("rejects %s drift between completed C03 and C04 without requesting audit",async kind=>{
 const m=setup();await start(m);m.finish();m.emit(1);await expect.poll(()=>m.detail.view.run?.status).toBe("succeeded");if(kind==="membership")m.run.artifactRefs=[];else m.artifact.inputHash="sha256:"+"b".repeat(64);
 await m.artifacts.load();await expect(m.artifacts.detail({runId:ids.run,artifactId:ids.artifact,evidenceId:ids.evidence})).rejects.toMatchObject({status:kind==="membership"?404:502});expect(m.requests.some(r=>r.url.includes("evidence-chains"))).toBe(false);
});
it("research read alone never grants audit read and retention expiry prevents subsequent preview",async()=>{
 const m=setup();m.finish();await m.artifacts.load();await m.artifacts.detail({artifactId:ids.artifact,runId:ids.run});await m.artifacts.evidenceChain(ids.correlation);m.advance(60000);const count=m.requests.length;await expect(m.artifacts.attachment()).rejects.toMatchObject({status:410});expect(m.requests).toHaveLength(count);
 const n=setup();n.finish();n.context.capabilities=n.context.capabilities.filter(c=>c!=="audit:read");await n.artifacts.load();await n.artifacts.detail({artifactId:ids.artifact,runId:ids.run});await expect(n.artifacts.evidenceChain(ids.correlation)).rejects.toMatchObject({status:403});expect(n.requests.some(r=>r.url.includes("evidence-chains"))).toBe(false);
});
it("permission_revoked closes the actual detail runtime and clears cursor/facts with no further dispatch",async()=>{
 const m=setup();await start(m);m.emit(1);await expect.poll(()=>m.detail.view.sequence).toBe(1);m.emit(1,{type:"permission_revoked"});await expect.poll(()=>m.invalidations).toEqual([403]);expect(m.detail.view.run).toBeUndefined();expect(m.detail.view.events).toEqual([]);expect(m.detail.view.sequence).toBe(0);expect(m.activeStreams).toBe(0);const count=m.requests.length;await expect(m.detail.refresh()).rejects.toThrow();expect(m.requests).toHaveLength(count);
});
it("route teardown releases modeled streams, clears uncertain intent and prevents late reads/writes",async()=>{
 const m=setup();await start(m);m.close();expect(m.activeStreams).toBe(0);expect(m.detail.view.run).toBeUndefined();expect(m.research.uncertain).toBe(false);const count=m.requests.length;
 await expect(m.research.create(m.form)).rejects.toThrow();await expect(m.snapshots.detail(ids.snapshot)).rejects.toThrow();await expect(m.artifacts.detail({artifactId:ids.artifact})).rejects.toThrow();expect(m.requests).toHaveLength(count);
});

it("expired creation deadline refuses dispatch even when a newly selected snapshot is fresh",async()=>{
 const m=setup();await m.research.load();m.advance(3600000);m.snapshot.maxAgeSeconds=7200;await expect(m.research.create(m.form)).rejects.toMatchObject({status:422,fields:{deadlineAt:expect.any(String)}});expect(writes(m)).toHaveLength(0);
});
