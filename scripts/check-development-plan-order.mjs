import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const policy = JSON.parse(readFileSync(new URL('./development-plan-order-policy.json', import.meta.url), 'utf8'));
const checkpointAnchor = (id) => `acceptance-${id.toLowerCase().replaceAll(':', '-')}`;
const canonical = (id) => id.includes(':') ? id : `FE:${id}`;
const equalSet = (actual, expected, message) => assert.deepEqual([...actual].sort(), [...expected].sort(), message);

function parseCheckpoints(text, document, root) {
  const markers = [...text.matchAll(/^<a id="(acceptance-[^"]+)"><\/a>\n/gm)];
  return markers.map((marker, index) => {
    const block = text.slice(marker.index, markers[index + 1]?.index ?? text.length);
    const json = /```json\n([\s\S]*?)\n```/.exec(block);
    assert(json, `${marker[1]}: missing checkpoint JSON`);
    const record = JSON.parse(json[1]);
    assert.equal(marker[1], checkpointAnchor(record.checkpoint_id), 'checkpoint anchor mismatch');
    assert.deepEqual(Object.keys(record).sort(), ['checkpoint_id', 'acceptance_window', 'depends_on', 'required_scope', 'review_status', 'source_commit', 'evidence'].sort(), `${record.checkpoint_id}: invalid checkpoint fields`);
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

// Static scheduling validation only. It never treats NOT_STARTED nodes as accepted
// or executes the gates; actual SHA-bound evidence remains independently required.
export function validatePlanOrder(coreText, frontendText, core, frontend, { root = fileURLToPath(new URL("../", import.meta.url)) } = {}) {
  const texts = [coreText, frontendText];
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
    nodes.set(node.id, node);
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
    }
    if (node.id.startsWith('CORE:')) {
      assert.equal(node.window, policy.coreWindows[node.task_id], `${node.id}: core acceptance window mismatch`);
      equalSet(node.dependencies, policy.corePrerequisites[node.task_id].map(canonical), `${node.id}: incomplete core prerequisites`);
    }
    if (node.checkpoint_id) {
      assert.equal(node.window, policy.checkpointWindows[node.id], `${node.id}: checkpoint window mismatch`);
      equalSet(node.dependencies, policy.checkpointDeps[node.id].map(canonical), `${node.id}: incomplete checkpoint prerequisites`);
      const heading = [...texts[node.document].slice(0, node.offset).matchAll(/^#### 迭代 ([AI]\d+)/gm)].at(-1)?.[1];
      if (node.document === 1 && node.window !== 'P0') assert.equal(heading, node.window, `${node.id}: checkpoint outside actual iteration`);
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
  return { schema: policy.schema, cross_plan_order: 'PASS', checkpoint_count: checkpoints.length, acceptance_node_count: nodes.size, dependency_edge_count: [...nodes.values()].reduce((n, x) => n + x.dependencies.length, 0), execution_order: order };
}
