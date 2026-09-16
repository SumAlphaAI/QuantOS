#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contractIds = Array.from({ length: 17 }, (_, index) => `C${String(index + 1).padStart(2, "0")}`);
const gapIds = contractIds.map((id) => `GAP-${id.slice(1)}`);
const frozenContracts = new Set(["C01", "C03", "C04", "C05", "C06", "C07", "C08", "C09", "C10", "C17"]);
const implementedContracts = new Set(["C01", "C10", "C17"]);
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

function declarations(protoSources, pattern) {
  return protoSources.reduce((total, source) => total + (source.match(pattern) ?? []).length, 0);
}

export function loadPre04Inputs(root = repoRoot) {
  const protoRoot = join(root, "proto/quantos");
  const protoSources = readdirSync(protoRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readFileSync(join(protoRoot, entry.name, "v1", `${entry.name}.proto`), "utf8"));
  return {
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

  const contractRows = tableRows(section(inputs.ledger, "## 2. 契约台账", "## 3."))
    .filter((row) => /^C\d{2}\b/.test(row[0]));
  const contractRowById = new Map(contractRows.map((row) => [row[0].match(/^C\d{2}/)?.[0], row]));
  check(JSON.stringify([...contractRowById.keys()]) === JSON.stringify(contractIds), "contract ledger contains C01-C17 exactly once and in order");
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
    if (implementedContracts.has(id)) check(row[8]?.includes("Implemented"), `${id} delivered contract is recorded as locally Implemented`);
    else if (frozenContracts.has(id)) check(row[8]?.includes("Contract Mocked"), `${id} frozen contract is recorded as Contract Mocked`);
  }

  const gapRows = tableRows(section(inputs.gaps, "| Gap ID", "## 统一基线"))
    .filter((row) => /^GAP-\d{2}$/.test(row[0]));
  const gapRowById = new Map(gapRows.map((row) => [row[0], row]));
  check(JSON.stringify([...gapRowById.keys()]) === JSON.stringify(gapIds), "gap list contains GAP-01-GAP-17 exactly once and in order");
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
  }

  const pre01Rows = tableRows(section(inputs.pre01Ledger, "## 2. 页面总台账", "## 3."));
  const expectedP0Pages = pre01Rows
    .filter((row) => /^(?:GS|P\d{2})$/.test(row[0] ?? "") && row[6] === "P0")
    .map((row) => row[0]);
  const dependencyRows = tableRows(section(inputs.ledger, "## 3. P0 页面", "## 4."))
    .filter((row) => /^(?:GS|P\d{2})\b/.test(row[0]));
  const dependencyIds = dependencyRows.map((row) => row[0].match(/^(?:GS|P\d{2})/)?.[0]);
  check(JSON.stringify(dependencyIds) === JSON.stringify(expectedP0Pages), "P0 dependency matrix matches the PRE-01 terminal P0 page set");
  for (const row of dependencyRows) {
    const id = row[0].match(/^(?:GS|P\d{2})/)?.[0];
    check(row.length === 4, `${id} dependency row has Query/Command/Realtime columns`);
    for (const [index, label] of [[1, "Query"], [2, "Command"], [3, "Realtime"]]) {
      const value = row[index] ?? "";
      check(Boolean(value) && !forbiddenPlaceholder.test(value), `${id} ${label} dependency is explicit`);
      check(/C\d{2}/.test(value) || /^无（.+）$/.test(value), `${id} ${label} names a contract or a reasoned none decision`);
      for (const ref of value.match(/C\d{2}/g) ?? []) check(contractIds.includes(ref), `${id} ${label} references known contract ${ref}`);
    }
  }

  const fieldSections = [...inputs.fields.matchAll(/^## \d+\. (C\d{2})\b/gm)].map((match) => match[1]);
  check(JSON.stringify(fieldSections) === JSON.stringify(contractIds), "field dictionary contains C01-C17 exactly once and in order");
  let fieldRows = 0;
  for (let index = 0; index < contractIds.length; index += 1) {
    const id = contractIds[index];
    const start = inputs.fields.search(new RegExp(`^## \\d+\\. ${id}\\b`, "m"));
    const tail = inputs.fields.slice(start);
    const next = tail.slice(1).search(/^## \d+\. C\d{2}\b/m);
    const rows = tableRows(next < 0 ? tail : tail.slice(0, next + 1));
    fieldRows += rows.length;
    check(rows.length > 0, `${id} has field dictionary rows`);
    for (const row of rows) {
      check(row.length === 4 && row.every(Boolean), `${id} field row has name/type/required/source`);
      check(!row.some((cell) => forbiddenPlaceholder.test(cell)), `${id} field row has no undecided placeholder`);
      check(/(?:proto|bff):/.test(row[3] ?? ""), `${id} field row has an authoritative proto/bff source`);
    }
  }

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
  check(JSON.stringify(sourceIds) === JSON.stringify(manifestIds), "generated operation manifest exactly matches OpenAPI");
  check(inputs.ledger.includes("62 个 operation") && inputs.ledger.includes("51 个 schema"), "ledger records current BFF operation/schema counts");

  const protoMetrics = {
    files: inputs.protoSources.length,
    messages: declarations(inputs.protoSources, /^message\s+/gm),
    enums: declarations(inputs.protoSources, /^enum\s+/gm),
    services: declarations(inputs.protoSources, /^service\s+/gm),
    rpcs: declarations(inputs.protoSources, /^\s*rpc\s+/gm),
    jsonSchemas: inputs.jsonSchemaCount,
  };
  check(JSON.stringify(protoMetrics) === JSON.stringify({ files: 6, messages: 38, enums: 15, services: 2, rpcs: 7, jsonSchemas: 48 }), "proto inventory matches the current generated baseline");
  check(inputs.ledger.includes("38 个领域 message") && inputs.ledger.includes("15 个枚举") && inputs.ledger.includes("48 个 JSON Schema"), "ledger records current proto/schema counts");

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
    const { checks: _checks, failures: _failures, ...summary } = report;
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  }
}
