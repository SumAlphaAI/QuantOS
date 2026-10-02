#!/usr/bin/env node

import { createHash } from "node:crypto";
import { renderFieldDictionary } from "./pre04-fields.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contractIds = Array.from({ length: 17 }, (_, index) => `C${String(index + 1).padStart(2, "0")}`);
const gapIds = contractIds.map((id) => `GAP-${id.slice(1)}`);
const forbiddenPlaceholder = /待开发时再定|待定义|待补充|\bTBD\b|\bTODO\b/i;

function section(markdown, heading, nextHeading) {
  const start = markdown.indexOf(heading);
  if (start < 0) return "";
  const end = nextHeading ? markdown.indexOf(nextHeading, start + heading.length) : -1;
  return markdown.slice(start, end < 0 ? undefined : end);
}

function tableRows(markdown) {
  return markdown.split("\n")
    .filter((line) => line.startsWith("|") && !/^\|\s*-+/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length > 1 && !["契约", "页面", "Gap ID", "字段", "资产"].includes(cells[0]));
}

const digest = value => createHash("sha256").update(value).digest("hex");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const taskIds = text => new Set([...text.matchAll(/^- task_id: `([^`]+)`/gm)].map(match => match[1]));
function referencedTasks(text) {
  return [...text.replace(/([A-Z]+)(\d{2})[–-]([A-Z]+)?(\d{2})/g, (_, prefix, begin, _endPrefix, end) =>
    Array.from({ length: Number(end) - Number(begin) + 1 }, (_, index) => prefix + String(Number(begin) + index).padStart(2, "0")).join("、")).matchAll(/\b[A-Z]+\d{2}\b/g)].map(match => match[0]);
}
export function expectedMockStatus(inputs, id) {
  const spec = inputs.baseline.contracts[id]; const published = inputs.catalog.contracts[id].publishedOperations.length;
  if (inputs.baseline.implementations[id]) return "Implemented（本地参考 provider；目标环境 NOT RUN / NO RECEIPT）";
  if (published) return "Contract Mocked（已发布面同源生成 client/schema/MSW；未配置场景返回501；planned 能力未冻结）";
  if (spec.inventoryFixtures.length) return "Inventory Fixture（未发布 OpenAPI；不得升级 Implemented）";
  return "Draft（未发布 OpenAPI；无同源业务 fixture）";
}
export function expectedGapStatus(inputs, id) {
  const entry = inputs.catalog.contracts[id];
  return !entry.publishedOperations.length ? "Open" : entry.plannedOperations.length ? "Partial" : "Closed";
}
function declarations(protoSources, pattern) {
  return protoSources.reduce((total, source) => total + (source.match(pattern) ?? []).length, 0);
}

export function loadPre04Inputs(root = repoRoot) {
  const protoRoot = join(root, "proto/quantos");
  const protoSources = readdirSync(protoRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readFileSync(join(protoRoot, entry.name, "v1", `${entry.name}.proto`), "utf8"));
  return {
    baseline: JSON.parse(readFileSync(join(root, "docs/PRE-04-inventory-baseline.json"), "utf8")),
    catalog: parseYaml(readFileSync(join(root, "bff/page-operation-catalog.yaml"), "utf8")),
    frontendPlan: readFileSync(join(root, "docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md"), "utf8"),
    corePlan: readFileSync(join(root, "docs/SumAlpha-QuantOS-Development-Plan.md"), "utf8"),
    evidenceFiles: Object.fromEntries(Object.values(JSON.parse(readFileSync(join(root, "docs/PRE-04-inventory-baseline.json"), "utf8")).implementations).flatMap(entry => entry.artifacts.map(({path}) => [path, readFileSync(join(root, path), "utf8")]))),
    fixtureFiles: Object.fromEntries(readdirSync(join(root, "tests/contract/fixtures"), { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(entry => readdirSync(join(root, "tests/contract/fixtures", entry.name)).filter(name => name.endsWith(".json")).map(name => {const path = `tests/contract/fixtures/${entry.name}/${name}`;return [path,readFileSync(join(root,path),"utf8")];}))),
    jsonSchemaFiles: Object.fromEntries(readdirSync(join(root, "proto/jsonschema")).filter(name => name.endsWith(".schema.json")).sort().map(name => [name, readFileSync(join(root,"proto/jsonschema",name),"utf8")])),
    ledger: readFileSync(join(root, "docs/PRE-04-contract-ledger.md"), "utf8"),
    gaps: readFileSync(join(root, "docs/PRE-04-openapi-gap-list.md"), "utf8"),
    fields: readFileSync(join(root, "docs/PRE-04-field-dictionary.md"), "utf8"),
    pre01Ledger: readFileSync(join(root, "docs/PRE-01-page-ledger-and-stories.md"), "utf8"),
    openapi: parseYaml(readFileSync(join(root, "bff/openapi/quantos-bff.v1.yaml"), "utf8")),
    manifest: JSON.parse(readFileSync(join(root, "tests/contract/generated/quantos-bff.operations.json"), "utf8")),
    protoSources,
    jsonSchemaCount: readdirSync(join(root, "proto/jsonschema")).filter((name) => name.endsWith(".schema.json")).length,
  };
}

export function validatePre04Inventory(inputs) {
  const failures = [];
  const checks = [];
  const check = (condition, message) => (condition ? checks : failures).push(message);

  const { baseline, catalog } = inputs;
  const coreIds = taskIds(inputs.corePlan); const frontendIds = taskIds(inputs.frontendPlan);
  check(baseline.schema === "quantos-pre04-baseline/v1", "controlled inventory baseline schema is v1");
  check(same(Object.keys(baseline.contracts), contractIds) && same(Object.keys(catalog.contracts), contractIds), "baseline and catalog cover C01-C17 exactly");
  check(digest(JSON.stringify(inputs.openapi)) === baseline.openapiDigest, "OpenAPI source identity matches reviewed baseline");
  check(digest(JSON.stringify(catalog)) === baseline.catalogDigest, "operation catalog identity matches reviewed baseline");
  check(same(inputs.protoSources.map(digest).sort(), baseline.protoDigests), "Proto source identities match reviewed baseline");
  const schemaDigests = Object.fromEntries(Object.entries(inputs.jsonSchemaFiles).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => [name, digest(value)]));
  check(same(schemaDigests, baseline.jsonSchemas), "JSON Schema identities match reviewed baseline");
  for (const [id, evidence] of Object.entries(baseline.implementations)) {
    check(evidence.scope === "local-reference-only" && evidence.targetAcceptance === "NOT_RUN / NO_RECEIPT", `${id} implementation receipt is local only`);
    check(Boolean(catalog.contracts[id]?.publishedOperations.length), `${id} implementation requires published operations`);
    for (const { path, sha256 } of evidence.artifacts) check(inputs.evidenceFiles[path] !== undefined && digest(inputs.evidenceFiles[path]) === sha256, `${id} provider/test/historical receipt matches ${path}`);
  }
  for (const [key, [source]] of Object.entries(baseline.domainMappings)) {
    if (source === "none") continue;
    const match = source.match(/^proto:(\w+)\.v1\.(\w+)\.(\w+)$/);
    const proto = match && inputs.protoSources.find(text => text.includes(`package quantos.${match[1]}.v1;`));
    const body = proto && proto.match(new RegExp(`message ${match[2]} \\{([\\s\\S]*?)^\\}`, "m"))?.[1];
    check(Boolean(body && new RegExp(`\\b${match[3]}\\s*=`).test(body)), `${key} resolves domain source ${source}`);
  }
  const contractRows = tableRows(section(inputs.ledger, "## 2. 契约台账", "## 3."))
    .filter((row) => /^C\d{2}\b/.test(row[0]));
  check(same(contractRows.map(row => row[0].match(/^C\d{2}/)?.[0]), contractIds), "contract ledger contains C01-C17 exactly once and in order");
  const contractRowById = new Map(contractRows.map((row) => [row[0].match(/^C\d{2}/)?.[0], row]));
  for (const id of contractIds) {
    const row = contractRowById.get(id) ?? [];
    check(row.length === 9, `${id} ledger row has all nine columns`);
    for (const [index, label] of [[1, "Query"], [2, "Command"], [3, "Realtime"]]) {
      check(Boolean(row[index]) && !forbiddenPlaceholder.test(row[index]), `${id} ${label} dependency is decided`);
    }
    check(Boolean(row[4]), `${id} has backend task ownership`);
    check(Boolean(row[5]), `${id} has proto coverage classification`);
    check(row[6]?.includes(`GAP-${id.slice(1)}`), `${id} links its matching OpenAPI gap`);
    check(row[7]?.includes("BFF TL") && row[7]?.includes("owner"), `${id} has BFF and domain role owners`);
    check(Boolean(row[8]) && !forbiddenPlaceholder.test(row[8]), `${id} has an explicit mock status`);
    const spec = baseline.contracts[id];
    check(row[0] === `${id} ${spec.name}` && row[5] === spec.protoCoverage && same(row.slice(1, 4), spec.surface), `${id} capability and domain coverage match reviewed decisions`);
    check(same(referencedTasks(row[4] ?? ""), spec.backendTasks) && spec.backendTasks.every(task => coreIds.has(task)), `${id} backend tasks resolve to reviewed core tasks`);
    check(row[7] === spec.owners && referencedTasks(row[7] ?? "").every(task => coreIds.has(task)), `${id} owners resolve to reviewed domain roles`);
    check(row[8] === expectedMockStatus(inputs, id), `${id} mock status matches published/fixture/provider evidence`);
    for (const path of [...spec.fixtures, ...spec.inventoryFixtures]) check(Boolean(inputs.fixtureFiles[path]), `${id} fixture exists: ${path}`);
  }

  const gapRows = tableRows(section(inputs.gaps, "| Gap ID", "## 统一基线"))
    .filter((row) => /^GAP-\d{2}$/.test(row[0]));
  check(same(gapRows.map(row => row[0]), gapIds), "gap list contains GAP-01-GAP-17 exactly once and in order");
  const gapRowById = new Map(gapRows.map((row) => [row[0], row]));
  for (const gapId of gapIds) {
    const row = gapRowById.get(gapId) ?? [];
    const contractId = `C${gapId.slice(4)}`;
    check(row.length === 9, `${gapId} has all nine inventory columns`);
    check(row[1] === contractId, `${gapId} maps to ${contractId}`);
    check(Boolean(row[2]) && !forbiddenPlaceholder.test(row[2]), `${gapId} operation surface is decided`);
    check(Boolean(row[3]) && Boolean(row[4]), `${gapId} has page and backend mappings`);
    check(/^P[01]$/.test(row[5] ?? ""), `${gapId} has a P0/P1 priority`);
    check(Boolean(row[6]) && /^BFF-FE-\d{3}(?:\/\d{3})?$/.test(row[7] ?? ""), `${gapId} has target stage and BFF task`);
    check(Boolean(row[8]), `${gapId} has an explicit status`);
    const entry = catalog.contracts[contractId]; const spec = baseline.contracts[contractId];
    const gapPages = (row[3] ?? "").split("、");
    const knownPages = new Set(tableRows(section(inputs.pre01Ledger, "## 2. 页面总台账", "## 3.")).map(page => page[0]));
    check(gapPages.every(page => knownPages.has(page)), `${gapId} pages resolve to phase-one PRE-01 pages`);
    const expectedPages = [...entry.pages, ...(contractId === "C01" ? ["GS", "WEB-06", "WEB-07"] : [])];
    check(same(gapPages, expectedPages), `${gapId} pages exactly match catalog and shared/website decisions`);
    check(same(referencedTasks(row[4] ?? ""), spec.backendTasks) && referencedTasks(row[4] ?? "").every(task => coreIds.has(task)), `${gapId} backend tasks resolve to core plan`);
    const ownerTasks = (row[7] ?? "").split("/").map((task, index) => index ? `BFF-FE-${task}` : task);
    check(ownerTasks.every(task => frontendIds.has(task)) && same(ownerTasks, [entry.ownerTask, ...(entry.coOwnerTask ? [entry.coOwnerTask] : [])]), `${gapId} BFF tasks resolve to catalog and frontend plan`);
    check(row[8] === expectedGapStatus(inputs, contractId), `${gapId} status matches published/planned operations`);
    const operationDecision = `已发布：${entry.publishedOperations.join("、") || "无"}；未发布：${entry.plannedOperations.join("、") || "无"}`;
    check(row[2] === operationDecision, `${gapId} accounts exactly for published/planned operation decisions`);
    check(row[5] === spec.priority && row[6] === spec.stage, `${gapId} priority/stage match reviewed phase-one mapping`);
  }

  const pre01Rows = tableRows(section(inputs.pre01Ledger, "## 2. 页面总台账", "## 3."));
  const expectedP0Pages = pre01Rows
    .filter((row) => /^(?:GS|WEB-\d{2}|P\d{2})$/.test(row[0] ?? "") && row[6] === "P0")
    .map((row) => row[0]);
  const dependencyRows = tableRows(section(inputs.ledger, "## 3. P0 页面", "## 4."))
    .filter((row) => /^(?:GS|WEB-\d{2}|P\d{2})\b/.test(row[0]));
  const dependencyIds = dependencyRows.map((row) => row[0].match(/^(?:GS|WEB-\d{2}|P\d{2})/)?.[0]);
  check(JSON.stringify(dependencyIds) === JSON.stringify(expectedP0Pages), "P0 dependency matrix matches the full phase-one PRE-01 P0 page set");
  for (const row of dependencyRows) {
    const id = row[0].match(/^(?:GS|WEB-\d{2}|P\d{2})/)?.[0];
    check(row.length === 4, `${id} dependency row has Query/Command/Realtime columns`);
    check(same(row.slice(1), baseline.pageDependencies[id]), `${id} dependencies match reviewed operation decisions`);
    const page = pre01Rows.find(candidate => candidate[0] === id);
    for (const ref of page?.[8]?.match(/C\d{2}/g) ?? []) check(row.slice(1).join(" ").includes(ref), `${id} includes PRE-01 auxiliary contract ${ref}`);
    for (const [index, label] of [[1, "Query"], [2, "Command"], [3, "Realtime"]]) {
      const value = row[index] ?? "";
      check(Boolean(value) && !forbiddenPlaceholder.test(value), `${id} ${label} dependency is explicit`);
      check(/C\d{2}/.test(value) || /^无（.+）$/.test(value), `${id} ${label} names a contract or a reasoned none decision`);
      for (const ref of value.match(/C\d{2}/g) ?? []) check(contractIds.includes(ref), `${id} ${label} references known contract ${ref}`);
    }
  }

  let fieldRows = 0;
  try {
    const expected = renderFieldDictionary(inputs); fieldRows = expected.fieldRows;
    check(inputs.fields === expected.markdown, "field dictionary exactly matches reviewed wire/domain/planned mapping");
  } catch (error) { check(false, `field dictionary source resolution failed: ${error.message}`); }
  check(!/\bP16\b|clearOfflineCache|checkUpdate|createDiagnosticJob|Platform owner|Desktop\/Web/.test(section(inputs.ledger, "## 2.", "## 4.") + section(inputs.gaps, "| Gap ID", "## 统一基线")), "phase-one inventory excludes native capabilities and owners");

  const sourceOperations = [];
  for (const [path, pathItem] of Object.entries(inputs.openapi.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (operation?.operationId) sourceOperations.push({ operationId: operation.operationId, method: method.toUpperCase(), path });
    }
  }
  const sourceIds = sourceOperations.map((operation) => operation.operationId).sort();
  const manifestIds = (inputs.manifest.operations ?? []).map((operation) => operation.operationId).sort();
  check(inputs.openapi.info?.version === "1.3.0", "BFF OpenAPI inventory version is 1.3.0");
  check(sourceOperations.length === 62, "BFF OpenAPI inventory has 62 operations");
  check(Object.keys(inputs.openapi.components?.schemas ?? {}).length === 51, "BFF OpenAPI inventory has 51 schemas");
  check(same(sourceIds, manifestIds), "generated operation IDs exactly match OpenAPI");
  const byId = entries => entries.map(({operationId, method, path}) => ({operationId, method, path})).sort((a, b) => a.operationId.localeCompare(b.operationId));
  check(same(byId(sourceOperations), byId(inputs.manifest.operations ?? [])), "generated operation manifest exactly matches OpenAPI");
  check(inputs.ledger.includes("62 个 operation") && inputs.ledger.includes("51 个 schema"), "ledger records current BFF operation/schema counts");

  const protoMetrics = {
    files: inputs.protoSources.length,
    messages: declarations(inputs.protoSources, /^message\s+/gm),
    enums: declarations(inputs.protoSources, /^enum\s+/gm),
    services: declarations(inputs.protoSources, /^service\s+/gm),
    rpcs: declarations(inputs.protoSources, /^\s*rpc\s+/gm),
    jsonSchemas: inputs.jsonSchemaCount,
  };
  check(JSON.stringify(protoMetrics) === JSON.stringify({ files: 6, messages: 38, enums: 15, services: 2, rpcs: 7, jsonSchemas: 50 }), "proto inventory matches the current generated baseline");
  check(inputs.ledger.includes("38 个领域 message") && inputs.ledger.includes("15 个枚举") && inputs.ledger.includes("50 个 JSON Schema"), "ledger records current proto/schema counts");

  return {
    schema: "quantos-pre04/v1",
    status: failures.length === 0 ? "PASS" : "FAIL",
    checks,
    failures,
    contracts: contractRowById.size,
    gaps: gapRowById.size,
    p0_pages: dependencyRows.length,
    field_rows: fieldRows,
    openapi_operations: sourceOperations.length,
    openapi_schemas: Object.keys(inputs.openapi.components?.schemas ?? {}).length,
    proto: protoMetrics,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = validatePre04Inventory(loadPre04Inputs());
  if (report.status === "FAIL") {
    for (const failure of report.failures) console.error(`FAIL  ${failure}`);
    process.exitCode = 1;
  } else {
    const summary = { ...report };
    delete summary.checks; delete summary.failures;
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  }
}
