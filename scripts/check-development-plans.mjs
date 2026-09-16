import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

// Project Markdown intake contract, not a Codex platform import/launch test.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const filenames = [
  "docs/SumAlpha-QuantOS-Development-Plan.md",
  "docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md",
];
const desktopPlanFilename = "docs/SumAlpha-QuantOS-Desktop-Development-Execution-Plan.md";
const range = (prefix, from, to, width = 2) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(width, "0")}`);
const coreIds = [
  ...range("F", 1, 9), ...range("TP", 1, 13),
  ..."ABCDEFG".split("").map((suffix) => `TP01-${suffix}`),
  ...range("R", 1, 4), "U01", ...range("S", 1, 4),
  ...range("X", 1, 6), ...range("L", 1, 4),
];
const frontendIds = [
  ...range("PRE-", 1, 6), ...range("FEP-", 0, 8, 1),
  ...range("BFF-FE-", 0, 11, 3), ...range("UI-", 101, 104, 3),
  ...range("UI-", 201, 204, 3), ...range("UI-", 301, 303, 3),
  ...range("UI-", 401, 403, 3), ...range("UI-", 501, 507, 3),
  ...range("UI-", 601, 603, 3), "WEB-101", "UI-VIS-000",
  ...range("UI-P", 1, 15), ...range("UI-P", 17, 23),
];
const iterations = ["P0", ...range("A", 1, 6, 1), ...range("I", 1, 10, 1)];
const workflow = "DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED";
const unquote = (text) => text.replace(/^`(.*)`$/, "$1");

function anchors(text) {
  const explicit = [...text.matchAll(/<a id="([^"]+)"><\/a>/g)].map((m) => m[1]);
  assert.equal(new Set(explicit).size, explicit.length, "duplicate explicit anchor");
  const result = new Set(explicit);
  const counts = new Map();
  for (const match of text.matchAll(/^#{1,6} (.+)$/gm)) {
    const slug = match[1].toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, "").replace(/\s/g, "-");
    const count = counts.get(slug) ?? 0;
    result.add(count ? `${slug}-${count}` : slug);
    counts.set(slug, count + 1);
  }
  return result;
}

function checkMarkdown(text, name) {
  assert(!text.includes("\r"), `${name}: use LF newlines`);
  assert(text.endsWith("\n"), `${name}: missing final newline`);
  assert(!/^(<<<<<<<|=======|>>>>>>>) /m.test(text), `${name}: conflict marker`);
  assert.equal((text.match(/^# /gm) ?? []).length, 1, `${name}: exactly one H1 required`);
  assert(text.includes("quantos-plan-review/v1"), `${name}: missing schema version`);
  assert(/^> 版本：\d+\.\d+/m.test(text), `${name}: missing document version`);
  assert(/^> 更新时间：\d{4}-\d{2}-\d{2}/m.test(text), `${name}: missing update date`);
  let previous = 0;
  let fenced = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("```")) { fenced = !fenced; continue; }
    if (fenced) continue;
    const match = /^(#+) /.exec(line);
    if (match) {
      assert(match[1].length <= 6 && match[1].length <= previous + 1, `${name}: skipped heading level: ${line}`);
      previous = match[1].length;
    }
    assert(!/^\t+[-*]/.test(line), `${name}: tab-indented list`);
  }
  assert(!fenced, `${name}: unclosed code fence`);
  return anchors(text);
}

function reviewRecords(body, key, value, required, id) {
  if (value === "[]") return [];
  assert.equal(value, "", `${id}: ${key} must be [] or a nested list`);
  const start = body.indexOf(`- ${key}:\n`);
  assert(start >= 0, `${id}: invalid ${key} list`);
  const lines = body.slice(start + key.length + 4).split("\n");
  const records = [];
  for (const line of lines) {
    if (!line.startsWith("  ")) break;
    const match = /^( {2}- | {4})([a-z_]+): (.+)$/.exec(line);
    assert(match, `${id}: invalid nested ${key} field`);
    if (match[1] === "  - ") records.push({});
    const record = records.at(-1);
    assert(record && !(match[2] in record), `${id}: duplicate/misplaced ${key} field`);
    record[match[2]] = unquote(match[3]);
  }
  assert(records.length > 0, `${id}: use [] for an empty ${key} list`);
  for (const record of records) {
    assert.deepEqual(Object.keys(record).sort(), [...required].sort(), `${id}: incomplete ${key} record`);
  }
  return records;
}

function parseTasks(text, expected, freshReview) {
  const markers = [...text.matchAll(/^<a id="task-([^"]+)"><\/a>\n(#{3,5}) (.+)\n/gm)];
  const records = markers.map((marker, index) => {
    const body = text.slice(marker.index, markers[index + 1]?.index ?? text.length);
    const fields = {};
    for (const match of body.matchAll(/^- ([a-z_]+):(?: (.*))?$/gm)) {
      assert(!(match[1] in fields), `${marker[1]}: duplicate field ${match[1]}`);
      fields[match[1]] = unquote(match[2] ?? "");
    }
    const id = fields.task_id;
    for (const key of ["task_id", "task_type", "development_status", "review_entry", "review_model", "review_status", "review_conclusion", "issues", "fix_tracking"]) {
      assert(key in fields, `${id ?? marker[1]}: missing ${key}`);
    }
    assert.equal(marker[1], id.toLowerCase(), `${id}: task anchor mismatch`);
    assert(marker[3].startsWith(`${id}：`), `${id}: title ID mismatch`);
    assert(body.includes(`<a id="review-${id.toLowerCase()}"></a>\n${"#".repeat(marker[2].length + 1)} GPT-6 Astra 功能复审`), `${id}: missing nested review module`);
    assert.equal(fields.review_entry, `[GPT-6 Astra 复审入口](#review-${id.toLowerCase()})`, `${id}: review link mismatch`);
    assert.equal(fields.review_model, "GPT-6 Astra", `${id}: wrong review model`);
    assert(["COMPLETED", "IMPLEMENTED_PENDING_ACCEPTANCE", "PARTIAL", "UNSPECIFIED"].includes(fields.development_status), `${id}: invalid development status`);
    assert(["NOT_STARTED", "IN_REVIEW", "CHANGES_REQUESTED", "FIX_VALIDATION", "RE_REVIEW", "ACCEPTED", "BLOCKED"].includes(fields.review_status), `${id}: invalid review status`);
    assert(/^- 需求描述：\S.*$/m.test(body), `${id}: missing requirement`);
    assert(/^- (量化验收标准|集成验收标准|验收标准|完成标准|目标阶段与验收|验收重点|页面级完成标准|交付节点与放行条件)：\S.*$/m.test(body), `${id}: missing acceptance criteria`);
    if (freshReview || fields.review_status === "NOT_STARTED") {
      assert.equal(fields.review_status, "NOT_STARTED", `${id}: review must be reset`);
      assert.equal(fields.review_conclusion, "null", `${id}: conclusion must be empty`);
      assert.equal(fields.issues, "[]", `${id}: issues must be empty at intake`);
      assert.equal(fields.fix_tracking, "[]", `${id}: fix tracking must be empty at intake`);
    }
    fields.issues = reviewRecords(body, "issues", fields.issues, ["issue_id", "severity", "description", "evidence", "status"], id);
    fields.fix_tracking = reviewRecords(body, "fix_tracking", fields.fix_tracking, ["issue_id", "fix_ref", "verification_command", "verification_environment", "verification_evidence", "verification_status"], id);
    const issueIds = fields.issues.map((issue) => issue.issue_id);
    assert.equal(new Set(issueIds).size, issueIds.length, `${id}: duplicate issue ID`);
    assert(fields.fix_tracking.every((fix) => issueIds.includes(fix.issue_id)), `${id}: fix references unknown issue`);
    if (fields.review_status === "ACCEPTED") {
      assert(fields.review_conclusion && fields.review_conclusion !== "null", `${id}: accepted review needs a conclusion`);
      for (const issue of fields.issues) {
        assert.equal(issue.status, "CLOSED", `${id}: accepted review has an open issue`);
        assert.equal(fields.fix_tracking.filter((fix) => fix.issue_id === issue.issue_id).at(-1)?.verification_status, "PASS", `${id}: accepted issue lacks passing validation`);
      }
    }
    if (fields.task_type === "CORE") {
      assert(/^- (阶段\/依赖|依赖)：\S.*$/m.test(body), `${id}: missing original dependency definition`);
    } else {
      assert.equal(fields.workflow, workflow, `${id}: workflow mismatch`);
      assert(iterations.includes(fields.iteration), `${id}: invalid iteration`);
      fields.depends_on = JSON.parse(fields.depends_on);
      assert(Array.isArray(fields.depends_on) && fields.depends_on.every((dep) => typeof dep === "string"), `${id}: depends_on must be a string array`);
      assert.equal(new Set(fields.depends_on).size, fields.depends_on.length, `${id}: duplicate dependency`);
      assert(["PREPARATION", "PAGE_API", "FRONTEND", "WEBSITE", "MILESTONE"].includes(fields.task_type), `${id}: invalid task type`);
      const expectedType = id.startsWith("BFF-FE-") ? "PAGE_API" : id.startsWith("PRE-") ? "PREPARATION" : id.startsWith("FEP-") ? "MILESTONE" : id.startsWith("WEB-") ? "WEBSITE" : "FRONTEND";
      assert.equal(fields.task_type, expectedType, `${id}: task ID/type mismatch`);
      if (fields.task_type !== "MILESTONE") {
        const parent = [...text.slice(0, marker.index).matchAll(/^(?:#### 迭代 ([AI]\d+)|迭代 `(P0)`)/gm)].at(-1);
        assert.equal(fields.iteration, parent?.[1] ?? parent?.[2], `${id}: iteration heading mismatch`);
      }
    }
    return { ...fields, requirement: /^- 需求描述：(.*)$/m.exec(body)[1], index };
  });
  assert.deepEqual(records.map((r) => r.task_id).sort(), [...expected].sort(), "missing, extra, or duplicate task IDs");
  return records;
}

export function validatePlans(coreText, frontendText, { root = projectRoot, freshReview = false } = {}) {
  const texts = [coreText, frontendText];
  const desktopPlanPath = resolve(root, desktopPlanFilename);
  assert(existsSync(desktopPlanPath), `missing ${desktopPlanFilename}`);
  const desktopText = readFileSync(desktopPlanPath, "utf8");
  assert(!frontendText.includes('<a id="task-ui-604"></a>'), "UI-604 must not return to the phase-one Web plan");
  assert(!frontendText.includes('<a id="task-ui-p16"></a>'), "UI-P16 must not return to the phase-one Web plan");
  for (const marker of ["UI-604", "UI-P16", "BFF-DESKTOP-001", "## 7. Desktop Gate"]) {
    assert(desktopText.includes(marker), `${desktopPlanFilename}: missing migrated Desktop marker ${marker}`);
  }
  const anchorSets = texts.map((text, i) => checkMarkdown(text, filenames[i]));
  const core = parseTasks(coreText, coreIds, freshReview);
  const frontend = parseTasks(frontendText, frontendIds, freshReview);
  assert(core.every((record) => record.task_type === "CORE"), "core task type mismatch");
  assert(!/^#### 10\.1\.\d+|FEP-1 交付核查记录|复验证据：|审查修复：/m.test(texts.join("\n")), "historical review block remains");
  const byId = new Map(frontend.map((record) => [record.task_id, record]));
  let lastIteration = -1;
  for (const record of frontend) {
    const rank = iterations.indexOf(record.iteration);
    assert(rank >= lastIteration, `${record.task_id}: iteration order regressed`);
    lastIteration = rank;
    for (const dep of record.depends_on) {
      if (dep.startsWith("CORE:")) {
        assert(coreIds.includes(dep.slice(5)), `${record.task_id}: unknown core dependency ${dep}`);
        continue;
      }
      const target = byId.get(dep);
      assert(target, `${record.task_id}: unknown dependency ${dep}`);
      assert(target.index < record.index, `${record.task_id}: forward dependency or cycle via ${dep}`);
      assert(iterations.indexOf(target.iteration) <= rank, `${record.task_id}: dependency scheduled later`);
    }
  }
  const apiIds = range("BFF-FE-", 0, 11, 3);
  const apis = frontend.filter((record) => record.task_type === "PAGE_API");
  const ui = frontend.filter((record) => ["FRONTEND", "WEBSITE"].includes(record.task_type));
  assert(Math.max(...apis.map((r) => r.index)) < Math.min(...ui.map((r) => r.index)), "all APIs must precede frontend tasks");
  for (const record of ui) {
    assert(apiIds.every((id) => record.depends_on.includes(id)), `${record.task_id}: missing full API prerequisite`);
    assert(record.iteration.startsWith("I"), `${record.task_id}: frontend outside frontend iteration`);
  }
  for (const record of apis) assert(record.iteration.startsWith("A"), `${record.task_id}: API outside API iteration`);
  for (const id of ["FEP-1", ...range("UI-", 101, 104, 3), "WEB-101"]) {
    assert.equal(byId.get(id).development_status, "COMPLETED", `${id}: completed development marker lost`);
  }
  for (const [i, text] of texts.entries()) {
    for (const match of text.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) {
      const [path, fragment] = match[1].split("#");
      if (/^[a-z]+:/i.test(path)) continue;
      const target = path ? resolve(root, dirname(filenames[i]), decodeURIComponent(path)) : resolve(root, filenames[i]);
      assert(existsSync(target), `${filenames[i]}: broken local link ${match[1]}`);
      if (fragment) {
        const targetIndex = filenames.findIndex((name) => resolve(root, name) === target);
        const targetAnchors = targetIndex >= 0 ? anchorSets[targetIndex] : anchors(readFileSync(target, "utf8"));
        assert(targetAnchors.has(decodeURIComponent(fragment)), `${filenames[i]}: broken fragment ${match[1]}`);
      }
    }
  }
  return { schema: "quantos-plan-review/v1", structure: "PASS", desktop_scope_split: "PASS", platform_load: "NOT_RUN", model_review: "NOT_RUN", core_tasks: core.length, frontend_tasks: frontend.length, page_api_tasks: apis.length, page_tasks: ui.filter((r) => /^UI-P\d+$/.test(r.task_id)).length, tasks: [...core, ...frontend] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = validatePlans(...filenames.map((name) => readFileSync(resolve(projectRoot, name), "utf8")), { freshReview: process.argv.includes("--fresh-review") });
    if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else {
      const summary = { ...report };
      delete summary.tasks;
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    }
  } catch (error) {
    process.stderr.write(`Development plan validation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
