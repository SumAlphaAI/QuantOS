import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validatePlans } from './check-development-plans.mjs';

const actualCore = readFileSync(new URL('../docs/SumAlpha-QuantOS-Development-Plan.md', import.meta.url), 'utf8');
const actualFrontend = readFileSync(new URL('../docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md', import.meta.url), 'utf8');
// Mutation fixtures reset only the independent stage receipts. Future legitimate
// READY/BLOCKED records remain valid in the actual-plan test and are never erased.
function unassessedFixture(text) {
  const reset = gate => ({ ...gate, status: 'NOT_ASSESSED', input_digest: null, evidence: [] });
  return text.replace(/^- stage_gate: (.+)$/gm, (_, json) => `- stage_gate: ${JSON.stringify(reset(JSON.parse(json)))}`)
    .replace(/```json\n([\s\S]*?)\n```/g, (block, json) => {
      const value = JSON.parse(json);
      if (!value.checkpoint_id || !value.stage_gate) return block;
      value.stage_gate = reset(value.stage_gate);
      return `\x60\x60\x60json\n${JSON.stringify(value, null, 2)}\n\x60\x60\x60`;
    });
}
const core = unassessedFixture(actualCore);
const frontend = unassessedFixture(actualFrontend);
function changeTask(text, id, field, update) {
  const marker = `<a id="task-${id.toLowerCase()}"></a>`;
  const start = text.indexOf(marker); assert(start >= 0);
  const end = text.indexOf('<a id="task-', start + marker.length);
  const block = text.slice(start, end < 0 ? undefined : end);
  const pattern = new RegExp(`^- ${field}: (.+)$`, 'm');
  const match = pattern.exec(block); assert(match, `${id}: test field missing`);
  const before = JSON.parse(match[1]);
  const after = update(before);
  const changed = block.replace(pattern, `- ${field}: ${JSON.stringify(after)}`);
  return text.slice(0, start) + changed + (end < 0 ? '' : text.slice(end));
}
function checkpoint(text, id, update) {
  const marker = `<a id="acceptance-${id.toLowerCase().replaceAll(':', '-')}"></a>`;
  const start = text.indexOf(marker); assert(start >= 0);
  const match = /```json\n([\s\S]*?)\n```/.exec(text.slice(start)); assert(match);
  const begin = start + match.index;
  const before = JSON.parse(match[1]);
  update(before);
  return text.slice(0, begin) + `\x60\x60\x60json\n${JSON.stringify(before, null, 2)}\n\x60\x60\x60` + text.slice(begin + match[0].length);
}
function stageContract(text, update) {
  const match = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].find(item => /"schema"\s*:\s*"quantos-plan-stages\/v1"/.test(item[1]));
  assert(match, 'test stage contract missing');
  const contract = JSON.parse(match[1]); update(contract);
  return text.slice(0, match.index) + `\x60\x60\x60json\n${JSON.stringify(contract, null, 2)}\n\x60\x60\x60` + text.slice(match.index + match[0].length);
}
const check = (c = core, f = frontend) => validatePlans(c, f);

test('joint schedule is acyclic and preserves task/status boundaries', () => {
  const report = check(actualCore, actualFrontend);
  assert.equal(report.cross_plan_order, 'PASS');
  assert.equal(report.core_tasks, 47); assert.equal(report.frontend_tasks, 75);
  assert.equal(report.checkpoint_count, 37);
  assert.equal(report.stage_contract, 'PASS');
  assert.equal(report.dependency_basis, 'stage_gate');
  assert.equal(Object.values(report.stage_status_counts).reduce((sum, count) => sum + count, 0), report.acceptance_node_count);
  assert.equal(report.stage_counts.RELEASE, 2);
  assert(report.tasks.filter(x => x.task_type !== 'CORE').every(x => x.review_status === 'NOT_STARTED'));
  const order = report.execution_order;
  for (const [a,b] of [['CORE-GATE:R1-SERVICE','CORE-GATE:S2-SERVICE'], ['CORE-GATE:S2-SERVICE','CORE-GATE:X3-SERVICE'], ['PROVIDER:ALL','FE:UI-201'], ['FE:FEP-2','CORE:U01'], ['CORE:U01','CORE-GATE:R1'], ['CORE-GATE:X3','FE:FEP-7'], ['CORE-GATE:L4-SERVICE','FE:FEP-8'], ['FE:FEP-8','CORE:L04']]) {
    assert(order.indexOf(a) < order.indexOf(b), `${a} precedes ${b}`);
  }
});
test('restoring a complete R1 prerequisite for S2 services creates a rejected cycle', () => {
  const changed = changeTask(core, 'S01', 'depends_on', ds => ds.map(d => d === 'CORE-GATE:R1-SERVICE' ? 'CORE-GATE:R1' : d));
  assert.throws(() => check(changed), /cross-plan dependency cycle/);
});
test('research service waiting on its consumer page is rejected', () => {
  const changed = changeTask(core, 'R03', 'depends_on', ds => [...ds, 'FE:UI-201']);
  assert.throws(() => check(changed), /cross-plan dependency cycle/);
});
test('historical CORE:R04 to CORE:L04 probe now fails closed', () => {
  const changed = changeTask(frontend, 'BFF-FE-003', 'depends_on', ds => ds.map(d => d === 'CORE:R04' ? 'CORE:L04' : d));
  assert.throws(() => check(core, changed), /cycle|later-window prerequisite/);
});
test('an early identity API cannot silently depend on later research services', () => {
  const changed = changeTask(frontend, 'BFF-FE-001', 'depends_on', ds => [...ds, 'CORE:R01']);
  assert.throws(() => check(core, changed), /missing or unexpected core prerequisite|core prerequisites differ/);
});
test('a provider cannot wait for the consumer frontend Gate', () => {
  const changed = checkpoint(frontend, 'PROVIDER:A4', cp => cp.depends_on.push('FRONTEND-GATE:G2'));
  assert.throws(() => check(core, changed), /cross-plan dependency cycle/);
});
test('removing S2 service admission from a core execution task is rejected', () => {
  const changed = changeTask(core, 'X01', 'depends_on', ds => ds.filter(d => d !== 'CORE-GATE:S2-SERVICE'));
  assert.throws(() => check(changed), /incomplete core prerequisites/);
});
test('S2 service Gate cannot omit TP12 advance evaluation', () => {
  const changed = checkpoint(core, 'CORE-GATE:S2-SERVICE', cp => cp.depends_on = cp.depends_on.filter(d => d !== 'EVALUATION:TP12'));
  assert.throws(() => check(changed), /incomplete checkpoint prerequisites/);
});
test('I10 cannot drop testnet service admission even if metadata is edited with it', () => {
  let changed = changeTask(frontend, 'FEP-8', 'depends_on', ds => ds.filter(d => d !== 'CORE-GATE:L4-SERVICE'));
  changed = changeTask(changed, 'FEP-8', 'core_prerequisites', ds => ds.filter(d => d !== 'CORE-GATE:L4-SERVICE'));
  assert.throws(() => check(core, changed), /missing or unexpected core prerequisite/);
});
test('a new or existing frontend cannot skip the full provider Gate', () => {
  const changed = changeTask(frontend, 'UI-101', 'depends_on', ds => ds.filter(d => d !== 'PROVIDER:ALL'));
  assert.throws(() => check(core, changed), /missing window admission PROVIDER:ALL|missing all-provider prerequisite/);
});
test('G5 cannot be marked as closing in I4 before reconciliation', () => {
  const changed = checkpoint(frontend, 'FRONTEND-GATE:G5', cp => cp.acceptance_window = 'I4');
  assert.throws(() => check(core, changed), /later-window prerequisite|checkpoint window mismatch/);
});
test('moving the G1 block above I1 tasks is rejected', () => {
  const start = frontend.indexOf('<a id="acceptance-frontend-gate-g1"></a>');
  const end = frontend.indexOf('<a id="task-fep-1"></a>', start);
  const block = frontend.slice(start, end);
  const removed = frontend.slice(0,start) + frontend.slice(end);
  const insert = removed.indexOf('<a id="task-ui-103"></a>');
  const changed = removed.slice(0, insert) + block + removed.slice(insert);
  assert.throws(() => check(core, changed), /must precede its close\/execute position/);
});
test('milestone cannot omit its last child while retaining a Gate summary', () => {
  const changed = changeTask(frontend, 'FEP-5', 'depends_on', ds => ds.filter(d => d !== 'UI-P22'));
  assert.throws(() => check(core, changed), /missing child UI-P22/);
});
test('prose-only backend dependencies cannot drift from structured prerequisites', () => {
  const start = frontend.indexOf('<a id="task-fep-8"></a>');
  const f = frontend.slice(0,start) + frontend.slice(start).replace(/^- 主要后端依赖：.+$/m, '- 主要后端依赖：CORE:L04');
  assert.throws(() => check(core, f), /prose core prerequisites drifted/);
});
test('core closure mapping cannot become an implicit service alias', () => {
  const changed = changeTask(frontend, 'FEP-2', 'closes_core', () => ['SERVICE:TP01']);
  assert.throws(() => check(core, changed), /invalid closes_core mapping/);
});
test('ACCEPTED checkpoint needs SHA and evidence, not only a green word', () => {
  const changed = checkpoint(frontend, 'PROVIDER:ALL', cp => cp.review_status = 'ACCEPTED');
  assert.throws(() => check(core, changed), /accepted checkpoint needs full SHA/);
  const noEvidence = checkpoint(frontend, 'PROVIDER:ALL', cp => { cp.review_status = 'ACCEPTED'; cp.source_commit = 'a'.repeat(40); });
  assert.throws(() => check(core, noEvidence), /accepted checkpoint needs evidence/);
});
test('accepted checkpoint evidence must resolve', () => {
  const changed = checkpoint(core, 'CORE-GATE:F0', cp => cp.evidence = ['./audit/does-not-exist-acceptance.json']);
  assert.throws(() => check(changed), /missing evidence reference/);
});
test('missing checkpoint and unknown dependency fail closed', () => {
  const missing = frontend.replace('<a id="acceptance-provider-all"></a>', '<a id="retired-provider-all"></a>');
  assert.throws(() => check(core, missing), /checkpoint IDs/);
  const unknown = changeTask(core, 'X01', 'depends_on', ds => [...ds, 'SERVICE:UNKNOWN']);
  assert.throws(() => check(unknown), /unknown acceptance dependency/);
});

test('API windows cannot skip their preceding provider checkpoint', () => {
  const changed = changeTask(frontend, 'BFF-FE-006', 'depends_on', ds => ds.filter(d => d !== 'PROVIDER:A3'));
  assert.throws(() => check(core, changed), /missing window admission PROVIDER:A3/);
});
test('UI windows cannot skip the preceding reconciliation window', () => {
  const changed = changeTask(frontend, 'UI-506', 'depends_on', ds => ds.filter(d => d !== 'FRONTEND-WINDOW:I5'));
  assert.throws(() => check(core, changed), /missing window admission FRONTEND-WINDOW:I5/);
});


test('Web intake preserves the explicit no-model-review schema', () => {
  const changed = frontend.replace('- task_id: `PRE-03`', '- task_id: `PRE-03`\n- review_status: `ACCEPTED`');
  assert.throws(() => check(core, changed), /Web review metadata/);
});
test('missing Web task fields still fail closed', () => {
  assert.throws(() => check(core, frontend.replace('- task_id: `PRE-03`', '')), /missing task_id/);
});

test('both plans must publish exactly the same stage contract', () => {
  const changed = stageContract(frontend, contract => contract.dependency_basis = 'review_status');
  assert.throws(() => check(core, changed), /cross-plan stage contracts differ/);
  const missing = frontend.replace(/"schema"\s*:\s*"quantos-plan-stages\/v1"/, '"schema": "retired-plan-stages/v1"');
  assert.throws(() => check(core, missing), /exactly one stage contract required/);
});
test('changing both plans cannot defer correctness or functional deadlines to release', () => {
  for (const requirement of ['contracts', 'data-integrity', 'authorization', 'idempotency-recovery', 'deadline-semantics']) {
    const defer = contract => {
      contract.early_required = contract.early_required.filter(item => item !== requirement);
      contract.release_required.push(requirement);
    };
    assert.throws(() => check(stageContract(core, defer), stageContract(frontend, defer)), /stage contract differs from required policy/);
  }
});
test('both plans must retain every deferred release obligation', () => {
  for (const requirement of ['performance', 'soak', 'deployment', 'same-sha-ci', 'release-authorization']) {
    const drop = contract => contract.release_required = contract.release_required.filter(item => item !== requirement);
    assert.throws(() => check(stageContract(core, drop), stageContract(frontend, drop)), /stage contract differs from required policy/);
  }
});
test('tasks and checkpoints cannot omit, invent, or misclassify their stage gate', () => {
  const missingTask = core.replace(/^- stage_gate: .+\n/m, '');
  assert.throws(() => check(missingTask), /missing stage_gate/);
  const invalidTask = changeTask(core, 'R01', 'stage_gate', gate => ({ ...gate, stage: 'DIAGNOSTIC' }));
  assert.throws(() => check(invalidTask), /invalid stage_gate stage/);
  const wrongStage = changeTask(core, 'R01', 'stage_gate', gate => ({ ...gate, stage: 'RELEASE' }));
  assert.throws(() => check(wrongStage), /stage_gate differs from window stage/);
  const missingCheckpoint = checkpoint(frontend, 'PROVIDER:ALL', cp => delete cp.stage_gate);
  assert.throws(() => check(core, missingCheckpoint), /invalid checkpoint fields/);
  const extraCheckpoint = checkpoint(frontend, 'PROVIDER:ALL', cp => cp.stage_gate.accepted = true);
  assert.throws(() => check(core, extraCheckpoint), /invalid stage_gate fields/);
  const invalidStatus = changeTask(core, 'R01', 'stage_gate', gate => ({ ...gate, status: 'ACCEPTED' }));
  assert.throws(() => check(invalidStatus), /invalid stage_gate status/);
});
test('release prerequisites cannot block either development or integration', () => {
  for (const id of ['R01', 'U01']) {
    const changed = changeTask(core, id, 'depends_on', ds => [...ds, 'RELEASE-GATE:BETA']);
    assert.throws(() => check(changed), /release prerequisite must not block development or integration/);
  }
  const changed = checkpoint(frontend, 'PROVIDER:ALL', cp => cp.depends_on.push('RELEASE-GATE:LIVE-READINESS'));
  assert.throws(() => check(core, changed), /release prerequisite must not block development or integration/);
});
test('release gates cannot skip business closure or inherit the wrong stage', () => {
  const beta = checkpoint(frontend, 'RELEASE-GATE:BETA', cp => cp.depends_on = cp.depends_on.filter(dep => dep !== 'CORE-GATE:X3'));
  assert.throws(() => check(core, beta), /incomplete checkpoint prerequisites/);
  const live = checkpoint(core, 'RELEASE-GATE:LIVE-READINESS', cp => cp.depends_on = cp.depends_on.filter(dep => dep !== 'RELEASE-GATE:BETA'));
  assert.throws(() => check(live), /incomplete checkpoint prerequisites/);
  const stage = checkpoint(frontend, 'RELEASE-GATE:BETA', cp => cp.stage_gate.stage = 'INTEGRATION');
  assert.throws(() => check(core, stage), /stage_gate differs from window stage/);
});
test('historical ACCEPTED and completed tasks do not automatically become READY', () => {
  const report = check();
  const accepted = report.tasks.filter(task => task.review_status === 'ACCEPTED');
  assert(accepted.length > 0);
  assert(accepted.every(task => task.stage_gate.status === 'NOT_ASSESSED'));
  const complete = report.tasks.filter(task => task.development_status === 'COMPLETED');
  assert(complete.length > 0);
  assert(complete.every(task => task.stage_gate.status === 'NOT_ASSESSED'));
});
test('READY needs its own input digest and resolvable evidence', () => {
  const ready = { stage: 'DEVELOPMENT', status: 'READY', input_digest: `sha256:${'a'.repeat(64)}`, evidence: ['./audit/F01-remediation-2026-09-17.md'] };
  const update = gate => changeTask(core, 'F01', 'stage_gate', () => gate);
  assert.throws(() => check(update({ ...ready, input_digest: null })), /READY stage_gate needs input manifest digest/);
  assert.throws(() => check(update({ ...ready, input_digest: 'a'.repeat(40) })), /invalid stage_gate input manifest digest/);
  assert.throws(() => check(update({ ...ready, input_digest: [ready.input_digest] })), /invalid stage_gate input manifest digest/);
  assert.throws(() => check(update({ ...ready, evidence: [] })), /READY stage_gate needs evidence/);
  for (const ref of ['./audit/does-not-exist-stage-evidence.json', './audit', 'https://']) {
    assert.throws(() => check(update({ ...ready, evidence: [ref] })), /missing stage_gate evidence reference/);
  }
  const report = check(update(ready));
  assert.equal(report.stage_status_counts.READY, 1);
  assert.equal(report.platform_load, 'NOT_RUN');
  assert.equal(report.model_review, 'NOT_RUN');
});
test('unassessed stage gates cannot carry an apparent ready receipt', () => {
  const digest = changeTask(core, 'R01', 'stage_gate', gate => ({ ...gate, input_digest: `sha256:${'a'.repeat(64)}` }));
  assert.throws(() => check(digest), /unassessed stage_gate cannot carry an input receipt/);
  const evidence = changeTask(core, 'R01', 'stage_gate', gate => ({ ...gate, evidence: ['./audit/R01-freshness-assessment-2026-10-04.md'] }));
  assert.throws(() => check(evidence), /unassessed stage_gate cannot carry evidence/);
});
test('BLOCKED retains failure evidence and digest without being counted as READY', () => {
  const changed = changeTask(core, 'R01', 'stage_gate', gate => ({ ...gate, status: 'BLOCKED', input_digest: `sha256:${'b'.repeat(64)}`, evidence: ['./audit/R01-freshness-assessment-2026-10-04.md'] }));
  const report = check(changed);
  assert.equal(report.stage_status_counts.BLOCKED, 1);
  assert.equal(report.stage_status_counts.READY, 0);
  const missing = changeTask(changed, 'R01', 'stage_gate', gate => ({ ...gate, evidence: ['./audit/does-not-exist-failure.json'] }));
  assert.throws(() => check(missing), /missing stage_gate evidence reference/);
});
test('a READY chain needs READY prerequisites and its own evidence at every node', () => {
  const ready = gate => ({ ...gate, status: 'READY', input_digest: `sha256:${'c'.repeat(64)}`, evidence: ['./audit/F01-remediation-2026-09-17.md'] });
  const child = changeTask(core, 'F02', 'stage_gate', ready);
  assert.throws(() => check(child), /READY requires READY prerequisite CORE:F01/);
  const parentBlocked = changeTask(child, 'F01', 'stage_gate', gate => ({ ...ready(gate), status: 'BLOCKED' }));
  assert.throws(() => check(parentBlocked), /READY requires READY prerequisite CORE:F01/);
  const chain = changeTask(child, 'F01', 'stage_gate', ready);
  const report = check(chain);
  assert.equal(report.stage_status_counts.READY, 2);
  assert.equal(report.model_review, 'NOT_RUN');
  assert.equal(report.platform_load, 'NOT_RUN');
});
test('stage readiness never substitutes for formal acceptance evidence', () => {
  const changed = checkpoint(frontend, 'PROVIDER:A1', cp => {
    cp.stage_gate = { stage: 'DEVELOPMENT', status: 'READY', input_digest: `sha256:${'a'.repeat(64)}`, evidence: ['./audit/F01-remediation-2026-09-17.md'] };
    cp.review_status = 'ACCEPTED';
  });
  assert.throws(() => check(core, changed), /accepted checkpoint needs full SHA/);
});
test('release READY requires formal acceptance and all functional prerequisites', () => {
  const ready = cp => cp.stage_gate = { stage: 'RELEASE', status: 'READY', input_digest: `sha256:${'d'.repeat(64)}`, evidence: ['./audit/F01-remediation-2026-09-17.md'] };
  const engineeringOnly = checkpoint(frontend, 'RELEASE-GATE:BETA', ready);
  assert.throws(() => check(core, engineeringOnly), /release READY requires formal checkpoint ACCEPTED/);
  const unreadyDependencies = checkpoint(frontend, 'RELEASE-GATE:BETA', cp => {
    ready(cp); cp.review_status = 'ACCEPTED'; cp.source_commit = 'e'.repeat(40); cp.evidence = ['./audit/F01-remediation-2026-09-17.md'];
  });
  assert.throws(() => check(core, unreadyDependencies), /READY requires READY prerequisite CORE-GATE:R1/);
});
