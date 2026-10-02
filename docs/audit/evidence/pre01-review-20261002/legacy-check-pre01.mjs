#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  ledger: "docs/PRE-01-page-ledger-and-stories.md",
  matrix: "docs/PRE-01-route-permission-matrix.md",
  scenarios: "docs/PRE-01-acceptance-scenarios.md",
};

const range = (prefix, from, to) =>
  Array.from({ length: to - from + 1 }, (_, index) => `${prefix}${String(from + index).padStart(2, "0")}`);

export const expectedPages = ["GS", ...range("WEB-", 1, 7), ...range("P", 1, 23)];
const expectedStates = Array.from({ length: 7 }, (_, index) => `S${index + 1}`);

function section(text, start, end) {
  const startIndex = text.indexOf(start);
  assert(startIndex >= 0, `missing section: ${start}`);
  const endIndex = end ? text.indexOf(end, startIndex + start.length) : text.length;
  assert(endIndex >= 0, `missing section terminator: ${end}`);
  return text.slice(startIndex, endIndex);
}

function rows(text) {
  return text
    .split("\n")
    .filter((line) => /^\|.*\|$/.test(line) && !/^\|[-:| ]+\|$/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

function scenarioId(page, state) {
  return `ACC-${page}-${state}`;
}

export function validatePre01({ ledger, matrix, scenarios }) {
  const ledgerRows = rows(section(ledger, "## 2. 页面总台账", "## 3. Story 拆解"));
  const pageRows = ledgerRows.filter(([id]) => expectedPages.includes(id));
  assert.deepEqual(pageRows.map(([id]) => id), expectedPages, "page ledger must contain GS, WEB-01..07 and P01..23 exactly once and in order");
  assert.equal(new Set(pageRows.map(([id]) => id)).size, 31, "page ledger contains duplicate pages");
  for (const row of pageRows) {
    assert.equal(row.length, 10, `${row[0]}: ledger row must contain 10 fields`);
    assert(["P0", "P1"].includes(row[6]), `${row[0]}: invalid priority`);
    assert(["高", "中", "低"].includes(row[7]), `${row[0]}: invalid risk`);
    for (const index of [1, 3, 4, 5, 8, 9]) assert(row[index], `${row[0]}: empty required ledger field`);
  }

  const storyRows = rows(ledger).filter(([id]) => /^ST-(?:GS-\d{2}|WEB-\d{2}|P\d{2}-\d{2})$/.test(id));
  for (const row of storyRows) {
    assert.equal(row.length, 7, `${row[0]}: story row must contain 7 fields`);
    assert(["P0", "P1"].includes(row[2]), `${row[0]}: invalid priority`);
    assert(["高", "中", "低"].includes(row[6]), `${row[0]}: invalid risk`);
    for (const index of [1, 3, 4, 5]) assert(row[index], `${row[0]}: empty role, route, platform, or description`);
  }
  for (const page of expectedPages) {
    const matchesPage = ([id]) => page === "GS"
      ? id.startsWith("ST-GS-")
      : page.startsWith("WEB-")
        ? id === `ST-${page}`
        : id.startsWith(`ST-${page}-`);
    assert(storyRows.some(matchesPage), `${page}: missing story`);
  }

  const matrixBody = section(matrix, "## 2. Terminal 路由 × 角色矩阵", "## 5. 平台差异与模式约束");
  for (const page of expectedPages.filter((id) => id !== "GS")) {
    assert(new RegExp(`(?:^|[|、/ ])${page.replace("-", "\\-")}(?:$|[|、/ ])`, "m").test(matrixBody), `${page}: missing from route/permission matrix`);
  }
  for (const marker of ["访", "研", "开", "交", "风", "运", "管", "审", "<768px", "离线（DT）"]) {
    assert(matrix.includes(marker), `route/permission matrix missing dimension: ${marker}`);
  }

  const scenarioRows = rows(scenarios).filter(([id]) => /^ACC-(GS|WEB-\d{2}|P\d{2})-S[1-7]$/.test(id));
  const actualScenarioIds = scenarioRows.map(([id]) => id);
  const expectedScenarioIds = expectedPages.flatMap((page) => expectedStates.map((state) => scenarioId(page, state)));
  assert.deepEqual(actualScenarioIds, expectedScenarioIds, "acceptance scenarios must define S1..S7 for every page in ledger order");
  assert.equal(new Set(actualScenarioIds).size, 217, "acceptance scenario IDs must be unique");
  for (const row of scenarioRows) {
    assert.equal(row.length, 3, `${row[0]}: acceptance row must contain 3 fields`);
    assert(row[1] && row[2], `${row[0]}: acceptance state and criterion are required`);
  }
  assert(!/^\| ACC-WEB-S[1-7] /m.test(scenarios), "aggregate WEB scenarios are forbidden; each website page needs seven states");

  const traceRows = rows(section(scenarios, "## 6. 页面 → 追踪映射", "## 7. 覆盖统计"));
  const tracedPages = traceRows.flatMap(([page]) => page === "官网" ? [] : [page]).filter((page) => expectedPages.includes(page));
  assert.deepEqual(tracedPages, expectedPages, "traceability table must contain every page exactly once and in ledger order");
  for (const row of traceRows.filter(([page]) => expectedPages.includes(page))) {
    assert.equal(row.length, 7, `${row[0]}: trace row must contain page, frontend task, contract, BFF task, backend task, tests, and Gate`);
    assert(row.slice(1).every(Boolean), `${row[0]}: incomplete traceability row`);
  }

  return {
    schema: "quantos-pre01/v1",
    status: "PASS",
    pages: pageRows.length,
    stories: storyRows.length,
    acceptance_scenarios: scenarioRows.length,
    states_per_page: expectedStates.length,
    traceability_rows: tracedPages.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = validatePre01(Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(resolve(projectRoot, file), "utf8")])));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`PRE-01 validation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
