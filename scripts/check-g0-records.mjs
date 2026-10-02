#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(resolve(root,file),"utf8");
export function loadG0Inputs() {
  return { readiness:read("docs/gate-records/G0-readiness-assessment.md"), review:read("docs/gate-records/G0-PRE-01-review-record.md"), governance:JSON.parse(read("docs/gate-records/G0-current-governance.json")), plan:read("docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md") };
}
export function validateG0Records({readiness,review,governance,plan}) {
  assert.equal(governance.schema,"quantos-g0-governance/v1");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(governance.observedAt),"governance observation date required");
  assert.equal(governance.historicalSignature.date,"2026-08-14");
  assert(/^[a-f0-9]{40}$/.test(governance.historicalSignature.sourceSnapshotCommit),"historical source snapshot required");
  assert(review.includes("- [x] 六方全部签署通过"),"historical user-confirmed signature must be preserved");
  for (const text of [review,readiness]) assert(text.includes("历史") && text.includes("NOT_STARTED / NO CURRENT RECEIPT"),"historical records must not claim current G0 acceptance");
  const checkpoints = [...plan.matchAll(/```json\s*([\s\S]*?)```/g)].map(m=>JSON.parse(m[1]));
  const checkpoint=checkpoints.find(c=>c.checkpoint_id==="FRONTEND-GATE:G0");
  assert(checkpoint,"current formal G0 checkpoint missing");
  for (const key of ["checkpoint_id","review_status","source_commit","evidence"]) assert.deepEqual(governance.currentCheckpoint[key],checkpoint[key],`current G0 ${key} differs from execution plan`);
  assert.equal(checkpoint.review_status,"NOT_STARTED","current G0 activation requires independent acceptance and updated historical-record presentation");
  assert(checkpoint.source_commit===null && checkpoint.evidence.length===0,"NOT_STARTED G0 cannot have acceptance receipt");
  const ledger=review.split("## 3. 评审结论记录")[1]?.split("## 4. 修订记录")[0] ?? "";
  const rows=ledger.split("\n").filter(l=>l.startsWith("| ")).map(l=>l.split("|").slice(1,-1).map(c=>c.trim())).filter(c=>c.length===4 && /^\d{4}-\d{2}-\d{2}$/.test(c[2]));
  assert.equal(rows.length,10,"historical dated compatibility ledger must retain ten items");
  assert.equal(governance.leftovers.length,rows.length,"current leftover status coverage must match historical ledger");
  governance.leftovers.forEach((item,i)=>{
    assert.equal(item.id,`G0-L${String(i+1).padStart(2,"0")}`,"unique sequential leftover ID");
    assert.deepEqual([item.item,item.owner,item.deadline],rows[i].slice(0,3),`${item.id}: owner/deadline must match historical ledger`);
    // No target completion is inferred from local contract delivery. Complete target receipts
    // and an explicit acceptance workflow are required before introducing CLOSED statuses.
    assert.equal(item.status,item.deadline<governance.observedAt ? "OVERDUE_PENDING_REPLAN" : "OPEN",`${item.id}: elapsed date cannot remain open or silently close without target acceptance`);
    assert(Array.isArray(item.evidence) && item.evidence.length===0 && item.note,`${item.id}: pending item must explicitly record missing receipt`);
    assert(review.includes(`| ${item.id} | ${item.item} | ${item.status} | NO COMPLETE RECEIPT |`),`${item.id}: human-readable current status missing`);
  });
  return {schema:"quantos-g0-governance/v1",status:"PASS",historical_signature:"RECORDED_NOT_REVALIDATED",current_formal_g0:"NOT_STARTED / NO CURRENT RECEIPT",leftovers:10,overdue:governance.leftovers.filter(r=>r.status==="OVERDUE_PENDING_REPLAN").length};
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(validateG0Records(loadG0Inputs()),null,2)); }
  catch(error) {console.error(`G0 governance failed: ${error.message}`);process.exitCode=1;}
}
