import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validatePlans } from './check-development-plans.mjs';

const core = readFileSync(new URL('../docs/SumAlpha-QuantOS-Development-Plan.md', import.meta.url), 'utf8');
const frontend = readFileSync(new URL('../docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md', import.meta.url), 'utf8');
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
const check = (c = core, f = frontend) => validatePlans(c, f);

test('joint schedule is acyclic and preserves task/status boundaries', () => {
  const report = check();
  assert.equal(report.cross_plan_order, 'PASS');
  assert.equal(report.core_tasks, 47); assert.equal(report.frontend_tasks, 75);
  assert.equal(report.checkpoint_count, 35);
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
