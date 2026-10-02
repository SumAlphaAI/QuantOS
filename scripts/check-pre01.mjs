#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(resolve(root, file), "utf8");
export const requirements = JSON.parse(read("docs/PRE-01-requirements-baseline.json"));
const catalog = parseYaml(read("bff/page-operation-catalog.yaml"));
export const expectedPages = requirements.pages;
const states = ["默认", "加载", "空", "错误", "无权", "陈旧", "离线"];
const plan = read("docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md");
const core = read("docs/SumAlpha-QuantOS-Development-Plan.md");
const taskIds = text => new Set([...text.matchAll(/task_id: `([^`]+)`/g)].map(m => m[1]));
const frontendTasks = taskIds(plan), coreTasks = taskIds(core);
const pagePattern = /^(GS|WEB-\d{2}|P\d{2})$/;
const allRoutes = new Set([...requirements.terminalRoutes.flatMap(r => r.paths), ...requirements.websiteRoutes.map(r => r.path)]);
const unique = (values, message) => assert.equal(new Set(values).size, values.length, message);
const rows = text => text.split("\n").filter(line => /^\|.*\|$/.test(line) && !/^\|[-:| ]+\|$/.test(line)).map(line => line.split("|").slice(1, -1).map(c => c.trim()));
function section(text, start, end) {
  const index = text.indexOf(start); assert(index >= 0, `missing section: ${start}`);
  const last = end ? text.indexOf(end, index + start.length) : text.length;
  assert(last >= 0, `missing section terminator: ${end}`); return text.slice(index, last);
}
const paths = value => [...value.matchAll(/`([^`]+)`/g)].map(m => m[1]);
function routeField(value, id) {
  if (requirements.globalScopes.includes(value)) return;
  const found = paths(value); assert(found.length, `${id}: missing route binding`);
  assert.equal(value.replace(/`[^`]+`/g, "").replace(/[、\s]/g, ""), "", `${id}: invalid route syntax`);
  for (const route of found) assert(allRoutes.has(route), `${id}: unknown route ${route}`);
}
function roleField(value, id) {
  const roles = value.split("、"); assert(value, `${id}: missing role`);
  for (const role of roles) assert(requirements.roles.includes(role), `${id}: unknown role ${role}`);
  unique(roles, `${id}: duplicate role`);
}
function taskField(value, known, id) {
  const tokens = value.split(/[、/]/);
  for (const token of tokens) assert(known.has(token), `${id}: unknown task ${token}`);
  unique(tokens, `${id}: duplicate task`); return tokens;
}
export function loadPre01Inputs() {
  return { ledger: read("docs/PRE-01-page-ledger-and-stories.md"), matrix: read("docs/PRE-01-route-permission-matrix.md"), scenarios: read("docs/PRE-01-acceptance-scenarios.md"), coverage: read("docs/PRE-01-page-api-coverage-register.md") };
}
export function validatePre01({ ledger, matrix, scenarios, coverage = read("docs/PRE-01-page-api-coverage-register.md") }) {
  assert.equal(requirements.schema, "quantos-pre01-requirements/v1");
  assert.deepEqual(expectedPages, ["GS", ...Array.from({length:7}, (_,i)=>`WEB-${String(i+1).padStart(2,"0")}`), ...catalog.scope.pages], "requirement scope must match phase-one catalog");
  assert(plan.includes("P01–P15/P17–P23") && catalog.scope.excludedPages.P16.includes("Desktop phase two"), "phase-one scope basis must remain explicit");
  for (const text of [ledger, matrix, scenarios]) assert(!/\bW\/D\b|quantos:\/\/|\| (?:P16|ST-P16-\d+|ACC-P16-S\d)\b|\|[^\n]*\| P16 \||作为桌面端用户|Web\/Desktop|双端|桌面端仅/.test(text), "phase-one artifacts contain Desktop requirements");
  const pageRows = rows(section(ledger, "## 2. 页面总台账", "## 3. Story 拆解")).filter(([id]) => pagePattern.test(id));
  assert.deepEqual(pageRows.map(r=>r[0]), expectedPages, "page ledger must contain the 30 phase-one pages exactly once and in order");
  for (const row of pageRows) {
    assert.equal(row.length, 10, `${row[0]}: ledger row must contain 10 fields`);
    assert(row.every(Boolean), `${row[0]}: empty ledger field`);
    routeField(row[3], row[0]); assert.equal(row[4], row[0].startsWith("WEB-") ? "官网" : "Web", `${row[0]}: invalid platform`);
    assert(["P0","P1"].includes(row[6]) && ["高","中","低"].includes(row[7]), `${row[0]}: invalid priority/risk`);
  }
  const storyRows = rows(ledger).filter(([id])=>id.startsWith("ST-"));
  unique(storyRows.map(r=>r[0]), "duplicate Story ID");
  assert.deepEqual(storyRows.map(r=>r[0]), requirements.storyIds, "page and key-flow Story set must match requirement baseline");
  for (const row of storyRows) {
    const flow = row[0].startsWith("ST-FLOW-");
    assert.equal(row.length, flow ? 8 : 7, `${row[0]}: invalid story fields`);
    assert(row.every(Boolean), `${row[0]}: empty story field`);
    assert(["P0","P1"].includes(row[2]), `${row[0]}: invalid priority`);
    assert(["高","中","低"].includes(row[6]), `${row[0]}: invalid risk`);
    roleField(row[3], row[0]); routeField(row[4], row[0]);
    assert.equal(row[5], row[0].startsWith("ST-WEB-") ? "官网" : "Web", `${row[0]}: invalid platform`);
    const page = flow ? null : row[0].match(/^ST-(GS|P\d{2})-/)?.[1];
    if (page && paths(row[4]).length) for (const path of paths(row[4])) assert(requirements.terminalRoutes.some(r=>r.page===page && r.paths.includes(path)), `${row[0]}: route belongs to another page`);
    if (row[0].startsWith("ST-WEB-") && row[0]!=="ST-WEB-08") assert.deepEqual(paths(row[4]),requirements.websiteRoutes.filter(r=>`ST-${r.page}`===row[0]).map(r=>r.path),`${row[0]}: website route binding changed`);
    if (flow) {
      const pages = row[7].split("/");
      for (const page of pages) assert(expectedPages.includes(page), `${row[0]}: unknown flow page`);
      for (const path of paths(row[4])) assert(requirements.terminalRoutes.some(r=>pages.includes(r.page) && r.paths.includes(path)), `${row[0]}: flow route not in involved pages`);
    }
  }
  for (const page of expectedPages) assert(storyRows.some(r=> page.startsWith("WEB-") ? r[0]===`ST-${page}` : r[0].startsWith(`ST-${page}-`)), `${page}: missing story`);
  const terminal = rows(section(matrix, "## 2. Terminal 路由 × 角色矩阵", "## 3. 官网路由")).filter(r=>r[0].startsWith("`"));
  assert.equal(terminal.length, requirements.terminalRoutes.length, "terminal permission route group count");
  terminal.forEach((row,i)=>{
    const rule = requirements.terminalRoutes[i]; assert.equal(row.length,16, `${rule.page}: matrix fields`);
    assert.deepEqual(paths(row[0]),rule.paths, `${rule.page}: permission routes changed`);
    assert.equal(row[1].split("/")[0],rule.page, `${rule.page}: matrix page changed`);
    assert.deepEqual(row.slice(3,11),rule.roles, `${rule.page}: unauthorized permission change`);
    assert.equal(row[12],"Web", `${rule.page}: matrix platform`);
    assert(row[13] && row[14] && row[15], `${rule.page}: missing responsive/offline/risk dimension`);
  });
  const website = rows(section(matrix,"## 3. 官网路由", "## 4. 角色")).filter(r=>/^WEB-\d{2} /.test(r[1] ?? ""));
  assert.deepEqual(website.map(r=>({path:paths(r[0])[0],page:r[1].slice(0,6)})),requirements.websiteRoutes,"website permission route coverage");
  for (const marker of ["访","研","开","交","风","运","管","审","<768px","离线（Web）"]) assert(matrix.includes(marker), `route/permission matrix missing dimension: ${marker}`);
  const domain = rows(section(matrix,"## 4. 角色", "## 5. 平台差异"));
  const admin = domain.find(r=>r[0]==="成员/策略/能力/flag 治理");
  assert.deepEqual(admin?.slice(1),["–","–","–","–","–","✔（禁删最后管理员）","–"],"Admin domain permissions must remain admin-only");
  const scenarioRows = rows(scenarios).filter(([id])=>/^ACC-(GS|WEB-\d{2}|P\d{2})-S\d+$/.test(id));
  assert.deepEqual(scenarioRows.map(r=>r[0]),expectedPages.flatMap(p=>states.map((_,i)=>`ACC-${p}-S${i+1}`)), "acceptance scenarios must define S1..S7 for every page in ledger order");
  scenarioRows.forEach((r,i)=>{assert.equal(r.length,3,`${r[0]}: scenario fields`);assert.equal(r[1],states[i%7],`${r[0]}: state label mismatch`);assert(r[2],`${r[0]}: empty criterion`);});
  const flowRows = rows(scenarios).filter(([id])=>id.startsWith("ACC-FLOW-"));
  assert.deepEqual(flowRows.map(r=>r[0]),Array.from({length:10},(_,i)=>`ACC-FLOW-${String(i+1).padStart(2,"0")}`),"key-flow scenario set must contain all ten flows");
  for (const row of flowRows) assert(row.length===3 && row.every(Boolean), `${row[0]}: incomplete flow scenario`);
  for (const [id,criterion] of Object.entries(requirements.safetyCriteria)) assert.equal([...scenarioRows,...flowRows].find(r=>r[0]===id)?.[2],criterion,`${id}: frozen safety criterion changed; explicit requirement review required`);
  const traces = rows(section(scenarios,"## 6. 页面 → 追踪映射","## 7. 覆盖统计")).filter(r=>pagePattern.test(r[0]));
  assert.deepEqual(traces.map(r=>r[0]),expectedPages,"traceability table must contain every page exactly once and in ledger order");
  for (const row of traces) {
    const [page,frontend,contracts,bff,backend,tests,gate]=row;
    assert(row.length===7 && row.every(Boolean),`${page}: incomplete traceability row`);
    taskField(frontend,frontendTasks,page); taskField(backend,coreTasks,page);
    const owners = bff.startsWith("无（") ? [] : taskField(bff,frontendTasks,page);
    const refs = contracts.match(/C\d{2}/g) ?? [];
    const ledgerContracts = pageRows.find(r=>r[0]===page)[8].match(/C\d{2}/g) ?? [];
    for (const contract of ledgerContracts) assert(refs.includes(contract),`${page}: ledger contract ${contract} missing from traceability`);
    for (const contract of refs) {
      assert(catalog.contracts[contract],`${page}: unknown contract ${contract}`);
      const needed = contract==="C17" ? (page==="GS" ? ["BFF-FE-001","BFF-FE-011"] : [page==="P17" ? "BFF-FE-011" : "BFF-FE-001"]) : [catalog.contracts[contract].ownerTask];
      for (const owner of needed) assert(owners.includes(owner),`${page}: missing contract owner ${owner} for ${contract}`);
    }
    assert(tests.includes(`ACC-${page}-*`),`${page}: missing page scenario binding`);
    for (const ref of tests.split("、")) assert(ref===`ACC-${page}-*` || flowRows.some(r=>r[0]===ref), `${page}: unknown test reference ${ref}`);
    for (const ref of gate.split("/")) assert(/^G[0-8]$/.test(ref) && plan.includes(`FRONTEND-GATE:${ref}`),`${page}: unknown Gate ${ref}`);
  }
  const published = new Set(Object.values(catalog.contracts).flatMap(c=>c.publishedOperations));
  const planned = new Set(Object.values(catalog.contracts).flatMap(c=>c.plannedOperations));
  for (const [id, status] of [...coverage.matchAll(/\b([a-z]+[A-Z][A-Za-z0-9]*)（(published|planned)/g)].map(m=>[m[1],m[2]])) {
    assert((status==="published" ? published : planned).has(id),`${id}: publication status differs from catalog`);
  }
  const registered = rows(coverage).filter(r=>r[0]==="GS" || r[0]==="官网" || /^P\d{2}$/.test(r[0]));
  assert.deepEqual(registered.map(r=>r[0]),["GS","官网",...catalog.scope.pages],"API register must match phase-one page scope");
  for (const row of registered) assert(!/1\.[012]\.0/.test(row[7]+row[8]),`${row[0]}: API register references obsolete generated version`);
  return { schema:"quantos-pre01/v2", status:"PASS", pages:pageRows.length, stories:storyRows.filter(r=>!r[0].startsWith("ST-FLOW-")).length, flow_stories:8, acceptance_scenarios:scenarioRows.length, flow_scenarios:flowRows.length, states_per_page:7, traceability_rows:traces.length };
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try { process.stdout.write(JSON.stringify(validatePre01(loadPre01Inputs()),null,2)+"\n"); }
  catch (error) { process.stderr.write(`PRE-01 validation failed: ${error.message}\n`); process.exitCode=1; }
}
