import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const policy = JSON.parse(readFileSync(new URL('./development-plan-order-policy.json', import.meta.url), 'utf8'));
const checkpointAnchor = (id) => `acceptance-${id.toLowerCase().replaceAll(':', '-')}`;
const canonical = (id) => id.includes(':') ? id : `FE:${id}`;
const equalSet = (actual, expected, message) => assert.deepEqual([...actual].sort(), [...expected].sort(), message);

function parseStageContract(text, document) {
  const contracts = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)]
    .filter((match) => /"schema"\s*:\s*"quantos-plan-stages\/v1"/.test(match[1]))
    .map((match) => JSON.parse(match[1]));
  assert.equal(contracts.length, 1, `document ${document}: exactly one stage contract required`);
  return contracts[0];
}

function validateStageGate(node, root) {
  const gate = node.stage_gate;
  assert(gate && typeof gate === 'object' && !Array.isArray(gate), `${node.id}: missing stage_gate object`);
  equalSet(Object.keys(gate), ['stage', 'status', 'input_digest', 'evidence'], `${node.id}: invalid stage_gate fields`);
  assert(['DEVELOPMENT', 'INTEGRATION', 'RELEASE'].includes(gate.stage), `${node.id}: invalid stage_gate stage`);
  assert.equal(gate.stage, policy.windowStages[node.window], `${node.id}: stage_gate differs from window stage`);
  assert(['NOT_ASSESSED', 'READY', 'BLOCKED'].includes(gate.status), `${node.id}: invalid stage_gate status`);
  assert(Array.isArray(gate.evidence) && gate.evidence.every(ref => typeof ref === 'string' && ref.length > 0), `${node.id}: invalid stage_gate evidence`);
  const validDigest = typeof gate.input_digest === 'string' && /^sha256:[0-9a-f]{64}$/.test(gate.input_digest) && gate.input_digest.length === 71;
  assert(gate.input_digest === null || validDigest, `${node.id}: invalid stage_gate input manifest digest`);
  if (gate.status === 'READY') {
    assert(validDigest, `${node.id}: READY stage_gate needs input manifest digest`);
    assert(gate.evidence.length > 0, `${node.id}: READY stage_gate needs evidence`);
  } else if (gate.status === 'NOT_ASSESSED') {
    assert.equal(gate.input_digest, null, `${node.id}: unassessed stage_gate cannot carry an input receipt`);
    assert.equal(gate.evidence.length, 0, `${node.id}: unassessed stage_gate cannot carry evidence`);
  }
  // BLOCKED may retain failure evidence; it never becomes a usable prerequisite.
  for (const ref of gate.evidence) {
    let resolved = false;
    try {
      if (/^[a-z]+:/i.test(ref)) {
        const url = new URL(ref);
        resolved = url.protocol === 'https:' && Boolean(url.hostname);
      } else resolved = statSync(resolve(root, 'docs', ref.split('#')[0])).isFile();
    } catch { /* Unresolvable references are rejected below. */ }
    assert(resolved, `${node.id}: missing stage_gate evidence reference ${ref}`);
  }
}

function parseCheckpoints(text, document, root) {
  const markers = [...text.matchAll(/^<a id="(acceptance-[^"]+)"><\/a>\n/gm)];
  return markers.map((marker, index) => {
    const block = text.slice(marker.index, markers[index + 1]?.index ?? text.length);
    const json = /```json\n([\s\S]*?)\n```/.exec(block);
    assert(json, `${marker[1]}: missing checkpoint JSON`);
    const record = JSON.parse(json[1]);
    assert.equal(marker[1], checkpointAnchor(record.checkpoint_id), 'checkpoint anchor mismatch');
    assert.deepEqual(Object.keys(record).sort(), ['checkpoint_id', 'acceptance_window', 'depends_on', 'required_scope', 'stage_gate', 'review_status', 'source_commit', 'evidence'].sort(), `${record.checkpoint_id}: invalid checkpoint fields`);
    assert(typeof record.required_scope === 'string' && record.required_scope.length > 0, `${record.checkpoint_id}: missing scope`);
    assert(block.includes(record.required_scope + "\n\n```json"), `${record.checkpoint_id}: checkpoint scope prose differs from JSON`);
    assert(record.source_commit === null || /^[0-9a-f]{40}$/.test(record.source_commit), `${record.checkpoint_id}: invalid source commit`);
    assert(['NOT_STARTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'FIX_VALIDATION', 'RE_REVIEW', 'ACCEPTED', 'BLOCKED'].includes(record.review_status), `${record.checkpoint_id}: invalid review status`);
    assert(Array.isArray(record.evidence) && record.evidence.every(x => typeof x === 'string' && x.length > 0), `${record.checkpoint_id}: invalid evidence`);
    for (const ref of record.evidence) {
      assert(/^https:\/\//.test(ref) || existsSync(resolve(root, 'docs', ref)), `${record.checkpoint_id}: missing evidence reference ${ref}`);
    }
    if (record.review_status === 'NOT_STARTED') {
      assert.equal(record.source_commit, null, `${record.checkpoint_id}: unstarted checkpoint has source receipt`);
      assert.equal(record.evidence.length, 0, `${record.checkpoint_id}: unstarted checkpoint has evidence`);
    }
    if (record.review_status === 'ACCEPTED') {
      assert(/^[0-9a-f]{40}$/.test(record.source_commit ?? ''), `${record.checkpoint_id}: accepted checkpoint needs full SHA`);
      assert(record.evidence.length > 0, `${record.checkpoint_id}: accepted checkpoint needs evidence`);
    }
    return { ...record, id: record.checkpoint_id, window: record.acceptance_window, document, offset: marker.index };
  });
}

// Static scheduling and receipt-shape validation only. It never promotes historical
// acceptance to stage readiness, verifies evidence contents, or executes any gate.
export function validatePlanOrder(coreText, frontendText, core, frontend, { root = fileURLToPath(new URL("../", import.meta.url)) } = {}) {
  const texts = [coreText, frontendText];
  const contracts = texts.map(parseStageContract);
  assert.deepEqual(contracts[0], contracts[1], 'cross-plan stage contracts differ');
  assert.deepEqual(contracts[0], policy.stageContract, 'stage contract differs from required policy');
  const checkpoints = texts.flatMap((text, i) => parseCheckpoints(text, i, root));
  equalSet(checkpoints.map(x => x.id), Object.keys(policy.checkpointWindows), 'missing, extra, or duplicate checkpoint IDs');
  const tasks = [...core.map(x => ({ ...x, id: `CORE:${x.task_id}`, window: x.acceptance_window, document: 0 })),
    ...frontend.map(x => ({ ...x, id: `FE:${x.task_id}`, window: x.iteration, document: 1 }))].map(x => ({ ...x, offset: texts[x.document].indexOf(`<a id="task-${x.task_id.toLowerCase()}"></a>`) }));
  const nodes = new Map();
  for (const node of [...tasks, ...checkpoints]) {
    assert(!nodes.has(node.id), `duplicate acceptance node ${node.id}`);
    assert(Array.isArray(node.depends_on) && node.depends_on.every(x => typeof x === 'string'), `${node.id}: depends_on must be an array`);
    assert.equal(new Set(node.depends_on).size, node.depends_on.length, `${node.id}: duplicate dependencies`);
    node.dependencies = node.depends_on.map(canonical);
    assert.equal(new Set(node.dependencies).size, node.dependencies.length, `${node.id}: duplicate canonical dependencies`);
    assert(policy.windows.includes(node.window), `${node.id}: unknown acceptance window ${node.window}`);
    validateStageGate(node, root);
    if (node.stage_gate.stage === 'RELEASE' && node.stage_gate.status === 'READY') {
      assert(node.checkpoint_id && node.review_status === 'ACCEPTED', `${node.id}: release READY requires formal checkpoint ACCEPTED`);
    }
    nodes.set(node.id, node);
  }
  for (const node of nodes.values()) {
    for (const id of node.dependencies) {
      const dep = nodes.get(id);
      assert(!(node.stage_gate.stage !== 'RELEASE' && dep?.stage_gate.stage === 'RELEASE'), `${node.id}: release prerequisite must not block development or integration: ${id}`);
    }
  }
  // DFS first: make cycles visible even when they also violate scheduled windows.
  const visited = new Set(); const active = new Set(); const stack = []; const order = [];
  function visit(id) {
    assert(nodes.has(id), `unknown acceptance dependency ${id}`);
    assert(!active.has(id), `cross-plan dependency cycle: ${[...stack, id].join(' -> ')}`);
    if (visited.has(id)) return;
    active.add(id); stack.push(id);
    for (const dep of nodes.get(id).dependencies) visit(dep);
    stack.pop(); active.delete(id); visited.add(id); order.push(id);
  }
  for (const id of nodes.keys()) visit(id);
  for (const node of nodes.values()) {
    for (const id of node.dependencies) {
      const dep = nodes.get(id);
      assert(policy.windows.indexOf(dep.window) <= policy.windows.indexOf(node.window), `${node.id}: later-window prerequisite ${id} (${dep.window} > ${node.window})`);
      if (dep.document === node.document) assert(dep.offset < node.offset, `${node.id}: prerequisite ${id} must precede its close/execute position`);
      if (node.stage_gate.status === 'READY') assert.equal(dep.stage_gate.status, 'READY', `${node.id}: READY requires READY prerequisite ${id}`);
    }
    if (node.id.startsWith('CORE:')) {
      assert.equal(node.window, policy.coreWindows[node.task_id], `${node.id}: core acceptance window mismatch`);
      equalSet(node.dependencies, policy.corePrerequisites[node.task_id].map(canonical), `${node.id}: incomplete core prerequisites`);
      equalSet(node.core_prerequisites, node.depends_on.filter(id => /^(CORE:|CORE-GATE:|SERVICE:)/.test(id)), `${node.id}: core prerequisites differ from depends_on`);
      equalSet(node.closes_core, [], `${node.id}: core task cannot carry frontend closes_core mappings`);
    }
    if (node.checkpoint_id) {
      assert.equal(node.window, policy.checkpointWindows[node.id], `${node.id}: checkpoint window mismatch`);
      equalSet(node.dependencies, policy.checkpointDeps[node.id].map(canonical), `${node.id}: incomplete checkpoint prerequisites`);
      const heading = [...texts[node.document].slice(0, node.offset).matchAll(/^#### 迭代 ([AI]\d+)/gm)].at(-1)?.[1];
      if (node.document === 1 && node.window !== 'P0' && node.stage_gate.stage !== 'RELEASE') assert.equal(heading, node.window, `${node.id}: checkpoint outside actual iteration`);
    }
  }
  for (const task of frontend) {
    for (const id of policy.frontendAdmissions[task.task_id]) assert(task.depends_on.includes(id), `${task.task_id}: missing window admission ${id}`);
    assert(Array.isArray(task.core_prerequisites), `${task.task_id}: missing core_prerequisites`);
    const actual = task.depends_on.filter(x => /^(CORE:|CORE-GATE:|SERVICE:)/.test(x));
    equalSet(task.core_prerequisites, actual, `${task.task_id}: core prerequisites differ from depends_on`);
    equalSet(actual, policy.frontendCorePrerequisites[task.task_id], `${task.task_id}: missing or unexpected core prerequisite`);
    assert(Array.isArray(task.closes_core), `${task.task_id}: missing closes_core mapping`);
    equalSet(task.closes_core, policy.closureMappings[task.task_id] ?? [], `${task.task_id}: invalid closes_core mapping`);
    if (task.task_type === 'MILESTONE') {
      const bodyStart = frontendText.indexOf(`<a id="task-${task.task_id.toLowerCase()}"></a>`);
      const bodyEnd = frontendText.indexOf('<a id="task-', bodyStart + 1);
      const body = frontendText.slice(bodyStart, bodyEnd < 0 ? undefined : bodyEnd);
      const statement = /^- 主要后端依赖：(.+)$/m.exec(body)?.[1];
      assert.equal(statement, task.core_prerequisites.join('、') || '无', `${task.task_id}: prose core prerequisites drifted`);
      for (const child of policy.children[task.task_id]) assert(task.depends_on.includes(child), `${task.task_id}: missing child ${child}`);
      assert(task.depends_on.includes(`FRONTEND-GATE:G${task.task_id.slice(-1)}`), `${task.task_id}: milestone does not close after Gate`);
    }
    for (const id of task.closes_core) {
      const target = nodes.get(id);
      assert(target && (target.dependencies.includes(`FE:${task.task_id}`) ||
        target.dependencies.includes(`FRONTEND-GATE:G${task.task_id.slice(-1)}`)), `${task.task_id}: mapped core task lacks frontend closure dependency ${id}`);
    }
    if (['FRONTEND', 'WEBSITE'].includes(task.task_type)) assert(task.depends_on.includes('PROVIDER:ALL'), `${task.task_id}: missing all-provider prerequisite`);
  }
  // A required must-precede constraint is not a conventional prerequisite edge.
  assert(order.indexOf('CORE:TP10') < order.indexOf('CORE:U01'), 'TP10 evaluation must precede U01');
  const count = (field, values) => Object.fromEntries(values.map(value => [value, [...nodes.values()].filter(node => node.stage_gate[field] === value).length]));
  return { schema: policy.schema, stage_schema: policy.stageContract.schema, stage_contract: 'PASS', dependency_basis: policy.stageContract.dependency_basis,
    stage_counts: count('stage', ['DEVELOPMENT', 'INTEGRATION', 'RELEASE']), stage_status_counts: count('status', ['NOT_ASSESSED', 'READY', 'BLOCKED']),
    cross_plan_order: 'PASS', checkpoint_count: checkpoints.length, acceptance_node_count: nodes.size, dependency_edge_count: [...nodes.values()].reduce((n, x) => n + x.dependencies.length, 0), execution_order: order };
}
