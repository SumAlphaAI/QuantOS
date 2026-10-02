import { readFileSync } from 'node:fs';
import { validatePre01 } from './legacy-check-pre01.mjs';

// Historical replay uses frozen pre-remediation inputs and the old validator.
// Current regression coverage is scripts/tests/check-pre01.test.mjs.
// Mutations affect in-memory copies only.
const original = {
  ledger: readFileSync(new URL('./ledger.md', import.meta.url), 'utf8'),
  matrix: readFileSync(new URL('./matrix.md', import.meta.url), 'utf8'),
  scenarios: readFileSync(new URL('./scenarios.md', import.meta.url), 'utf8'),
};
const probes = [
  ['unknown-role', 'ledger', /^\| ST-P01-01 .*$/m, s => s.replace('| 访 |', '| 超级交易员 |')],
  ['unknown-route', 'ledger', /^\| ST-P01-01 .*$/m, s => s.replace('`/login`、`/auth/callback`', '`/nonexistent-route`')],
  ['duplicate-story', 'ledger', /^\| ST-P01-01 .*$/m, s => s + '\n' + s],
  ['missing-key-flows', 'ledger', /^\| ST-FLOW-.*\n/gm, () => ''],
  ['missing-flow-scenarios', 'scenarios', /^\| ACC-FLOW-.*\n/gm, () => ''],
  ['unsafe-proposal-criterion', 'scenarios', /^\| ACC-P09-S5 .*$/m, () => '| ACC-P09-S5 | 无权 | 无需权限即可下单 |'],
  ['unknown-trace-task', 'scenarios', /^\| P02 \|.*$/m, s => s.replace('UI-P02', 'UI-NOT-EXIST')],
  ['unauthorized-admin-grant', 'matrix', /^\| `\/admin\/members`.*$/m, s => s.replaceAll('–', '✔')],
  ['missing-permission-route', 'matrix', /^\| `\/orders`.*\n/m, () => ''],
  ['phase-one-scope-without-P16', 'ledger', /^\| P16 \|.*\n/m, () => ''],
];
const results = probes.map(([name, key, pattern, replacement]) => {
  const changed = original[key].replace(pattern, replacement);
  if (changed === original[key]) throw new Error(`Probe did not mutate: ${name}`);
  try { validatePre01({ ...original, [key]: changed }); return { name, gate: 'ACCEPTED', mutated: true }; }
  catch (error) { return { name, gate: 'REJECTED', mutated: true, reason: error.message }; }
});
const rows = text => text.split('\n').filter(s => s.startsWith('| ')).map(s => s.split('|').slice(1, -1).map(s => s.trim()));
const stories = rows(original.ledger).filter(r => /^ST-(GS-\d+|WEB-\d+|P\d+-\d+)$/.test(r[0]));
const webStories = stories.filter(r => !r[0].startsWith('ST-P16-') && r[5] !== 'DT');
const flows = rows(original.ledger).filter(r => /^ST-FLOW-/.test(r[0]));
const currentPages = ['GS', ...Array.from({length:7}, (_,i)=>`WEB-0${i+1}`), ...Array.from({length:23}, (_,i)=>`P${String(i+1).padStart(2,'0')}`)].filter(s=>s!=='P16');
const pages = rows(original.ledger).filter(r => currentPages.includes(r[0]));
const inventory = {
  current_page_units: pages.length,
  current_pages_with_seven_ids: currentPages.filter(p => Array.from({length:7},(_,i)=>`ACC-${p}-S${i+1}`).every(id=>rows(original.scenarios).some(r=>r[0]===id))).length,
  page_stories_all_phases: stories.length,
  page_stories_excluding_P16_and_DT_only: webStories.length,
  web_story_priority: Object.fromEntries(['P0','P1'].map(p=>[p,webStories.filter(r=>r[2]===p).length])),
  current_page_priority: Object.fromEntries(['P0','P1'].map(p=>[p,pages.filter(r=>r[6]===p).length])),
  flow_stories: flows.length,
  flow_scenarios: rows(original.scenarios).filter(r=>/^ACC-FLOW-/.test(r[0])).length,
  terminal_matrix_group_rows: rows(original.matrix).filter(r=>r.length===16 && r[0].startsWith('`')).length,
};
console.log(JSON.stringify({ inventory, probes: results }, null, 2));
