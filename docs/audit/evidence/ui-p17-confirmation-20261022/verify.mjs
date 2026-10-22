// Confirmation closure only: preserve the original packet, no functional rerun or phase promotion.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { verify, validateState, omitted } from '../../../../scripts/ui-p17-review.mjs';
import { validateUserConfirmation, bytesDigest } from '../../../../scripts/user-acceptance-confirmation.mjs';
import { nodesFromPlans, planInput } from '../../../../scripts/provider-a1-receipts.mjs';
const directory = 'docs/audit/evidence/ui-p17-confirmation-20261022';
const original = 'docs/audit/evidence/ui-p17-local-20261022';
const sourcePacket = 'cfb2dba32c96772cefc2d53efb4ed56000490101';
const sourceCommit = 'dae4d0148439ea06d871caab74d7f2403a36a33a';
const read = p => readFileSync(p), json = p => JSON.parse(read(p));
const approval = json(directory + '/approval.json'), record = json(approval.record), receipt = json(original + '/receipt.json');
const expectedText = '确认 UI-P17 本轮完整确认稿，范围绑定工程 SHA dae4d014，保留 Firefox 环境阻塞、WebKit 拦截附件接收阻塞及全部 NOT_RUN，不提升联调或发布验收状态。请保存本次原始确认、执行门禁、同步计划并生成本地 Git 提交，不推送或部署。';
assert.equal(record.confirmationSource.text, expectedText);
assert.equal(read(directory + '/raw-user-message.txt').toString(), expectedText);
assert.equal(record.request.sourceCommit, sourceCommit);
assert.equal(record.request.inputsDigest, receipt.inputDigest);
assert.equal(record.confirmationSource.rawRecord, directory + '/raw-user-message.txt');
assert.equal(record.request.nodeId, 'FE:UI-P17');
assert.equal(record.document, original + '/confirmation-draft.md');
for (const path of [record.document, original + '/receipt.json', original + '/evidence-index.json']) {
  assert.deepEqual(read(path), execFileSync('git', ['show', `${sourcePacket}:${path}`], { maxBuffer: 16e6 }), 'original packet drift ' + path);
}
const index = json(original + '/evidence-index.json');
for (const artifact of index.files) {
  assert(artifact.path.startsWith(original + '/') && !artifact.path.includes('..'));
  const bytes = read(artifact.path); assert.equal(bytes.length, artifact.bytes); assert.equal(bytesDigest(bytes), artifact.sha256, 'historical evidence drift ' + artifact.path);
  assert.deepEqual(bytes, execFileSync('git', ['show', `${sourcePacket}:${artifact.path}`], {maxBuffer: 32e6}), 'sealed artifact drift ' + artifact.path);
}
for (const artifact of index.additionalDocuments) {
  const bytes = execFileSync('git', ['show', `${sourcePacket}:${artifact.path}`], {maxBuffer:32e6});
  assert.equal(bytes.length, artifact.bytes); assert.equal(bytesDigest(bytes), artifact.sha256);
  if (artifact.path !== 'docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md') assert.deepEqual(read(artifact.path),bytes);
}
const plans = ['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'];
const sealedPlans = nodesFromPlans(plans.map(path => execFileSync('git',['show',`${sourcePacket}:${path}`],{encoding:'utf8',maxBuffer:4e6})));
const currentPlans = nodesFromPlans(); assert.equal(currentPlans.size,sealedPlans.size);
for (const [id,node] of currentPlans) {
  const old = sealedPlans.get(id); assert.deepEqual(node.stage_gate,old.stage_gate,id+' stage gate changed'); assert.deepEqual(planInput(node),planInput(old),id+' requirements changed');
  if(id !== 'FE:UI-P17') assert.equal(node.development_status,old.development_status,id+' unrelated status changed');
}
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
for (const [field, value] of Object.entries({ confirmation: 'CONFIRMED', stageGate: 'READY', firefoxBrowser: 'PASS', webKitAttachmentBrowser: 'PASS', formalAccepted: true, runtimeAdmission: 'ALLOWED', localModuleComposition: 'PASS_PRODUCTION', liveSettingsStream: 'CONNECTED', recursiveDependencyRevalidation: true, ...Object.fromEntries(Object.keys(notRun).map(k => [k, 'PASS'])) })) reject('false phase or omitted-check promotion ' + field, () => validateState({ ...receipt, [field]: value }));
const task = nodesFromPlans().get('FE:UI-P17');
assert.equal(task.development_status, 'COMPLETED');
assert.deepEqual(task.stage_gate, { stage: 'INTEGRATION', status: 'NOT_ASSESSED', input_digest: null, evidence: [] });
const proof = {
  schema: 'quantos-ui-p17-confirmation-closure/v1', nodeId: 'FE:UI-P17', sourcePacket, sourceCommit,
  confirmation, approval, originalEngineering, originalDraftSha256: bytesDigest(read(record.document)), originalReceiptSha256: bytesDigest(read(original + '/receipt.json')),
  originalEvidenceIndexSha256: bytesDigest(read(original + '/evidence-index.json')), preservedEvidenceFiles: index.files.length, preservedPlanStageGates: currentPlans.size,
  gateSha256: bytesDigest(read(fileURLToPath(import.meta.url))), negativeProbes: negatives,
  originalPacketPending: receipt.confirmation, localModuleComposition: receipt.localModuleComposition, liveSettingsStream: receipt.liveSettingsStream, recursiveDependencyRevalidation: false,
  referenceOnly: true, developmentStatus: 'COMPLETED_CURRENT_FUNCTION_SCOPE_ONLY', stageGate: 'NOT_ASSESSED', firefoxBrowser: 'BLOCKED_ENVIRONMENT', webKitAttachmentBrowser: 'BLOCKED_ENVIRONMENT_TEST_INTERCEPTION', ...notRun,
  formalAccepted: false, runtimeAdmission: 'DENIED', currentReady: 'NOT_CLAIMED', currentHeadAcceptance: 'NOT_CLAIMED', functionalTestsRerun: false,
};
if (process.argv[2] === '--record') writeFileSync(directory + '/closure-proof.json', JSON.stringify(proof, null, 2) + '\n');
else { assert.equal(process.argv[2], '--verify'); assert.deepEqual(json(directory + '/closure-proof.json'), proof); }
console.log(JSON.stringify({ confirmation: confirmation.status, sourceCommit, sourcePacket, engineering: originalEngineering.engineeringStatus, preservedEvidenceFiles: index.files.length, preservedPlanStageGates: currentPlans.size, negativeProbes: negatives.length, stageGate: proof.stageGate, firefoxBrowser: proof.firefoxBrowser, webKitAttachmentBrowser: proof.webKitAttachmentBrowser, formalAccepted: false, runtimeAdmission: 'DENIED', functionalTestsRerun: false }));
