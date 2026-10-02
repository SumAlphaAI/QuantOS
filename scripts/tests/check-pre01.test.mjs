import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { validatePre01 } from "../check-pre01.mjs";
import { loadG0Inputs, validateG0Records } from "../check-g0-records.mjs";

const root = resolve(new URL("../..", import.meta.url).pathname);
const valid = {
  ledger: readFileSync(resolve(root, "docs/PRE-01-page-ledger-and-stories.md"), "utf8"),
  matrix: readFileSync(resolve(root, "docs/PRE-01-route-permission-matrix.md"), "utf8"),
  scenarios: readFileSync(resolve(root, "docs/PRE-01-acceptance-scenarios.md"), "utf8"),
  coverage: readFileSync(resolve(root, "docs/PRE-01-page-api-coverage-register.md"), "utf8"),
};

test("current PRE-01 artifacts satisfy the executable contract", () => {
  const report = validatePre01(valid);
  assert.deepEqual(
    { pages: report.pages, scenarios: report.acceptance_scenarios, traceability: report.traceability_rows },
    { pages: 30, scenarios: 210, traceability: 30 },
  );
});

test("missing a page state fails closed", () => {
  const broken = { ...valid, scenarios: valid.scenarios.replace(/^\| ACC-WEB-03-S7 .*\n/m, "") };
  assert.throws(() => validatePre01(broken), /acceptance scenarios must define S1\.\.S7/);
});

test("invalid story priority fails closed", () => {
  const broken = { ...valid, ledger: valid.ledger.replace(/(\| ST-P01-01 .*?\| )P0( \|)/, "$1P2$2") };
  assert.throws(() => validatePre01(broken), /ST-P01-01: invalid priority/);
});

test("missing traceability row fails closed", () => {
  const broken = { ...valid, scenarios: valid.scenarios.replace(/^\| P23 \|.*\n/m, "") };
  assert.throws(() => validatePre01(broken), /traceability table must contain every page/);
});

const mutations = [
  ["published operation cannot regress to planned", "coverage", /createExport（published）/, ()=>"createExport（planned）", /publication status/],
  ["unknown role", "ledger", /^\| ST-P01-01 .*$/m, s=>s.replace("| 访 |","| 超级交易员 |"), /unknown role/],
  ["unknown route", "ledger", /^\| ST-P01-01 .*$/m, s=>s.replace("`/login`、`/auth/callback`","`/nonexistent-route`"), /unknown route/],
  ["duplicate story", "ledger", /^\| ST-P01-01 .*$/m, s=>s+"\n"+s, /duplicate Story/],
  ["missing flow stories", "ledger", /^\| ST-FLOW-.*\n/gm, ()=>"", /Story set/],
  ["missing flow scenarios", "scenarios", /^\| ACC-FLOW-.*\n/gm, ()=>"", /ten flows/],
  ["unsafe proposal criterion", "scenarios", /^\| ACC-P09-S5 .*$/m, ()=>"| ACC-P09-S5 | 无权 | 无需权限即可下单 |", /safety criterion/],
  ["unknown trace task", "scenarios", /^\| P02 \|.*$/m, s=>s.replace("UI-P02","UI-NOT-EXIST"), /unknown task/],
  ["unauthorized admin grant", "matrix", /^\| `\/admin\/members`.*$/m, s=>s.replaceAll("–","✔"), /permission change/],
  ["missing permission route", "matrix", /^\| `\/orders`.*\n/m, ()=>"", /permission route group/],
  ["phase-one P16", "ledger", /^\| P17 \|.*$/m, s=>s+"\n| P16 | Desktop | v2 | `/settings/desktop` | Web | 全部 | P1 | 中 | C17 | FEP-6 |", /Desktop requirements/],
  ["missing contract owner", "scenarios", /^\| P02 \|.*$/m, s=>s.replace("/BFF-FE-006",""), /missing contract owner/],
  ["empty flow role", "ledger", /^\| ST-FLOW-01 .*$/m, s=>s.replace("| 研、开 |","|  |"), /empty story field/],
  ["empty flow route", "ledger", /^\| ST-FLOW-01 .*$/m, s=>s.replace(/\| `\/data-snapshots`.*? \| Web/,"|  | Web"), /empty story field/],
  ["state label mismatch", "scenarios", /^\| ACC-P02-S4 .*$/m, s=>s.replace("| 错误 |","| 默认 |"), /state label/],
  ["desktop-only story", "ledger", /^\| ST-P02-01 .*$/m, s=>s.replace("| Web |","| DT |"), /invalid platform/],
  ["persistent offline cache", "scenarios", /^\| ACC-P04-S7 .*$/m, ()=>"| ACC-P04-S7 | 离线 | 必须显示加密的持久领域缓存 |", /safety criterion/],
  ["admin domain permission", "matrix", /^\| 成员\/策略\/能力\/flag 治理 .*$/m, s=>s.replace(/– \|$/,"R |"), /Admin domain permissions/],
  ["missing page story", "ledger", /^\| ST-P05-01 .*\n/m, ()=>"", /Story set/],
  ["cross-page route", "ledger", /^\| ST-P01-01 .*$/m, s=>s.replace("`/login`、`/auth/callback`","`/orders`"), /another page/],
];
for (const [name,key,pattern,change,error] of mutations) test(`${name} fails closed`,()=>{
  const changed=valid[key].replace(pattern,change);
  assert.notEqual(changed,valid[key],"negative probe must actually alter the artifact");
  assert.throws(()=>validatePre01({...valid,[key]:changed}),error);
});
test("current G0 governance preserves history without granting current acceptance",()=>{
  const result=validateG0Records(loadG0Inputs()); assert.equal(result.overdue,9); assert.equal(result.current_formal_g0,"NOT_STARTED / NO CURRENT RECEIPT");
});
test("past-due G0 item cannot silently remain OPEN",()=>{
  const input=loadG0Inputs(); input.governance.leftovers[0].status="OPEN";
  assert.throws(()=>validateG0Records(input),/elapsed date/);
});
test("fabricated G0 acceptance fails against current checkpoint",()=>{
  const input=loadG0Inputs(); input.governance.currentCheckpoint.review_status="ACCEPTED";
  assert.throws(()=>validateG0Records(input),/differs from execution plan/);
});
test("missing G0 leftover owner fails",()=>{
  const input=loadG0Inputs(); input.governance.leftovers[0].owner="";
  assert.throws(()=>validateG0Records(input),/owner\/deadline/);
});
