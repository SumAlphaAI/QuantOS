import {it,expect} from "vitest";
import {researchDetailNotice,researchDetailMetrics} from "../src/research/detail-presentation";
import {researchStatuses,type ResearchRun} from "../src/research/policy";
const run:ResearchRun={runId:"11111111-1111-4111-8111-000000000001",capability:"research.hypothesis.v1",dataSnapshotId:"11111111-1111-4111-8111-000000000001",status:"queued",budget:"1000000",deadlineAt:"2026-10-23T01:00:00Z",createdAt:"2026-10-23T00:00:00Z",engineVersion:"pending",inputHash:"sha256:"+"a".repeat(64),evidenceRefs:[],correlationId:"11111111-1111-4111-8111-000000000001"};
it("covers all six authoritative statuses without implying accepted cancel is final",()=>{expect(Object.keys(researchDetailNotice)).toEqual([...researchStatuses]);expect(researchDetailNotice.cancel_requested).toContain("受理不等于任务已停止");expect(researchDetailNotice.running).toContain("中间输出不代表最终结论");});
it.each(researchStatuses)("renders explicit notice for %s",status=>expect(researchDetailNotice[status]).toBeTruthy());
it("keeps absent cost and progress absent, and exact integer budget and pending engine",()=>expect(researchDetailMetrics(run)).toEqual({progress:"未提供",cost:"未提供",budget:"1000000",deadlineAt:run.deadlineAt,engine:"pending"}));
it.each(["0","12.34567890"])("does not round or infer cost %s",costUnits=>expect(researchDetailMetrics({...run,costUnits}).cost).toBe(costUnits));
