// Confirmation closure only: preserve the original packet, no functional rerun or phase promotion.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { verify, validateState, omitted } from '../../../../scripts/ui-p02-review.mjs';
import { validateUserConfirmation, bytesDigest } from '../../../../scripts/user-acceptance-confirmation.mjs';
import { nodesFromPlans } from '../../../../scripts/provider-a1-receipts.mjs';
const directory = 'docs/audit/evidence/ui-p02-confirmation-20261022';
const original = 'docs/audit/evidence/ui-p02-local-20261022';
const sourcePacket = 'a9a3dbc70585960dbc683c19226804e6abe6cf18';
const sourceCommit = 'a2132f51276d6fb802ec0094ab40fba3052fc860';
const read = p => readFileSync(p), json = p => JSON.parse(read(p));
const approval = json(directory + '/approval.json'), record = json(approval.record), receipt = json(original + '/receipt.json');
const expectedText = '确认 UI-P02 本轮完整确认稿，范围绑定工程 SHA a2132f51，保留 Firefox 环境阻塞及全部 NOT_RUN，不提升联调或发布验收状态。请保存本次原始确认、执行门禁、同步计划并生成本地 Git 提交，不推送或部署。';
assert.equal(record.confirmationSource.text, expectedText);
assert.equal(read(directory + '/raw-user-message.txt').toString(), expectedText);
assert.equal(record.request.sourceCommit, sourceCommit);
assert.equal(record.request.inputsDigest, receipt.inputDigest);
assert.equal(record.confirmationSource.rawRecord, directory + '/raw-user-message.txt');
assert.equal(record.request.nodeId, 'FE:UI-P02');
assert.equal(record.document, original + '/confirmation-draft.md');
for (const path of [record.document, original + '/receipt.json', original + '/evidence-index.json']) {
  assert.deepEqual(read(path), execFileSync('git', ['show', `${sourcePacket}:${path}`], { maxBuffer: 16e6 }), 'original packet drift ' + path);
}
const index = json(original + '/evidence-index.json');
for (const artifact of index.files) { assert(artifact.path.startsWith(original + '/') && !artifact.path.includes('..')); assert.equal(bytesDigest(read(artifact.path)), artifact.sha256, 'historical evidence drift ' + artifact.path); }
const confirmation = validateUserConfirmation(approval, record.request);
const originalEngineering = verify(receipt);
const notRun = Object.fromEntries(omitted.map(k => [k, receipt[k]]));
const negatives = [];
function reject(name, fn) { assert.throws(fn, name); negatives.push(name); }
reject('missing approval', () => validateUserConfirmation({}, record.request));
reject('altered record digest', () => validateUserConfirmation({ ...approval, recordSha256: bytesDigest('wrong') }, record.request));
for (const [field, value] of [['sourceCommit', sourcePacket], ['inputsDigest', bytesDigest('wrong')]]) reject('changed request ' + field, () => validateUserConfirmation(approval, { ...record.request, [field]: value }));
for (const [field, value] of [['approver', 'Codex'], ['documentSha256', bytesDigest('wrong')], ['confirmationSource', { kind: 'AGENT', text: expectedText }]]) {
  const changed = Buffer.from(JSON.stringify({ ...record, [field]: value }));
  reject('altered confirmation ' + field, () => validateUserConfirmation({ ...approval, recordSha256: bytesDigest(changed) }, record.request, p => p === approval.record ? changed : read(p)));
}
for (const [field, value] of Object.entries({ confirmation: 'CONFIRMED', stageGate: 'READY', firefoxBrowser: 'PASS', formalAccepted: true, runtimeAdmission: 'ALLOWED', localModuleComposition: 'PASS_PRODUCTION', liveCommandStream: 'CONNECTED', recursiveDependencyRevalidation: true, ...Object.fromEntries(Object.keys(notRun).map(k => [k, 'PASS'])) })) reject('false phase or omitted-check promotion ' + field, () => validateState({ ...receipt, [field]: value }));
const task = nodesFromPlans().get('FE:UI-P02');
assert.equal(task.development_status, 'COMPLETED');
assert.deepEqual(task.stage_gate, { stage: 'INTEGRATION', status: 'NOT_ASSESSED', input_digest: null, evidence: [] });
const proof = {
  schema: 'quantos-ui-p02-confirmation-closure/v1', nodeId: 'FE:UI-P02', sourcePacket, sourceCommit,
  confirmation, approval, originalEngineering, originalDraftSha256: bytesDigest(read(record.document)), originalReceiptSha256: bytesDigest(read(original + '/receipt.json')),
  originalEvidenceIndexSha256: bytesDigest(read(original + '/evidence-index.json')), preservedEvidenceFiles: index.files.length,
  gateSha256: bytesDigest(read(fileURLToPath(import.meta.url))), negativeProbes: negatives,
  originalPacketPending: receipt.confirmation, localModuleComposition: receipt.localModuleComposition, liveCommandStream: receipt.liveCommandStream, recursiveDependencyRevalidation: false,
  referenceOnly: true, developmentStatus: 'COMPLETED_CURRENT_FUNCTION_SCOPE_ONLY', stageGate: 'NOT_ASSESSED', firefoxBrowser: 'BLOCKED_ENVIRONMENT', ...notRun,
  formalAccepted: false, runtimeAdmission: 'DENIED', currentReady: 'NOT_CLAIMED', currentHeadAcceptance: 'NOT_CLAIMED', functionalTestsRerun: false,
};
if (process.argv[2] === '--record') writeFileSync(directory + '/closure-proof.json', JSON.stringify(proof, null, 2) + '\n');
else { assert.equal(process.argv[2], '--verify'); assert.deepEqual(json(directory + '/closure-proof.json'), proof); }
console.log(JSON.stringify({ confirmation: confirmation.status, sourceCommit, sourcePacket, engineering: originalEngineering.engineeringStatus, preservedEvidenceFiles: index.files.length, negativeProbes: negatives.length, stageGate: proof.stageGate, firefoxBrowser: proof.firefoxBrowser, formalAccepted: false, runtimeAdmission: 'DENIED', functionalTestsRerun: false }));
