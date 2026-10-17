// TP12 is a reference/boundary task. Only current evidence and directly relevant controls run.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {root,inventory,digest,nodesFromPlans,planInput,staticEnvironment} from './provider-a1-receipts.mjs';
export const testingPolicy=JSON.parse(readFileSync(resolve(root,'scripts/development-testing-policy.json')));
export const checks=[
  {
    "id": "review",
    "command": [
      "python3",
      "scripts/tp12-boundary-review.py"
    ],
    "reason": "Current X3 rule/interface/threat mapping, pinned reference bytes and all production import/manifest/lock exclusion; no upstream execution"
  },
  {
    "id": "review-tests",
    "command": [
      "python3",
      "-m",
      "unittest",
      "discover",
      "-s",
      "scripts/tests",
      "-p",
      "test_tp12_*.py",
      "-v"
    ],
    "reason": "Current and reference evaluators: source/tree tamper, dependency alias/dynamic loads, protocol/authority and phase promotion refusal"
  },
  {
    "id": "agent",
    "command": [
      "engines/.venv/bin/python",
      "-m",
      "pytest",
      "engines/tests/test_tp12_nautilus_agents_rules.py",
      "engines/tests/test_tp12_x3_boundary.py",
      "-q",
      "-s"
    ],
    "reason": "Actual owned adapter all authority field aliases/tools plus real local Agent UDS subprocess, advisory proposals, replay and rejection recovery"
  },
  {
    "id": "issuer-refusal",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "--test",
      "x03_authority",
      "x03_seven_rejections_and_recovery_do_not_consume_approval",
      "--",
      "--exact",
      "--nocapture"
    ],
    "reason": "NC03 current owned issuer rejects forged risk, expiry and failed approval paths without consuming approval"
  },
  {
    "id": "approval",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "--test",
      "x03_authority",
      "x03_approval_cas_rejection_cancellation_expiry_and_originator_separation",
      "--",
      "--exact",
      "--nocapture"
    ],
    "reason": "NC03 independent approval CAS, no self-approval, cancellation and expiry on the current issuer"
  },
  {
    "id": "dispatch",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "--test",
      "tp07_dispatch",
      "--",
      "--nocapture"
    ],
    "reason": "Actual dispatch source changed: all eight direct tests cover current-risk/kill, concurrent dedupe, approval binding, uncertain claims, rollback and isolated consumers"
  },
  {
    "id": "sanitized",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "--test",
      "tp12_boundary",
      "tp12_signed_dispatch_sanitizes_current_authority_and_agent_trace_cannot_submit",
      "--",
      "--exact",
      "--nocapture"
    ],
    "reason": "NC04 exact sanitized kernel key allowlist excludes decision/approval/signature/tenant/actor/session data"
  },
  {
    "id": "trace-closure",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-reconcile",
      "--test",
      "x05_flow",
      "x05_rehashed_journal_still_cannot_forge_close_without_acknowledgement",
      "--",
      "--exact",
      "--nocapture"
    ],
    "reason": "NC05 even rehashed caller journal cannot forge authoritative exception closure without service-owned CAS state"
  },
  {
    "id": "artifact",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-runtime",
      "--test",
      "signal_proposal_orchestration",
      "r04_consumes_r03_artifact_with_bound_provenance_and_rejects_invalid_references",
      "--",
      "--exact",
      "--nocapture"
    ],
    "reason": "NC02/05 current runtime consumes only bound owned artifacts and rejects invalid references; narrow direct boundary regression"
  },
  {
    "id": "lint",
    "command": [
      "engines/.venv/bin/ruff",
      "check",
      "scripts/tp12-boundary-review.py",
      "scripts/tests/test_tp12_boundary_review.py",
      "engines/tests/test_tp12_x3_boundary.py"
    ],
    "reason": "Static Python checks on the new evaluator, mutation tests and native Agent probes; unchanged Rust packages compile in selected tests"
  },
  {
    "id": "gate-tests",
    "command": [
      "node",
      "--test",
      "scripts/tp12-local-gate.test.mjs"
    ],
    "reason": "Fail-closed source/log/check-set/phase/dependency/target admission and publication rollback behavior"
  },
  {
    "id": "plan-policy",
    "command": [
      "node",
      "--test",
      "scripts/development-plan-order-negative.mjs"
    ],
    "reason": "Shared plan validator changed only for TP12 scoped local receipt; retain all scheduling and refusal cases"
  },
  {
    "id": "plans",
    "command": [
      "node",
      "scripts/check-development-plans.mjs"
    ],
    "reason": "Both plans and registered TP12 stage scope remain consistent; no upstream readiness promoted"
  },
  {
    "id": "core-handoff",
    "command": [
      "node",
      "scripts/check-development-gate-handoff.mjs"
    ],
    "reason": "Keep original TP12 review, no-runtime and minimum five prohibitions plus integration/release obligations"
  },
  {
    "id": "frontend-handoff",
    "command": [
      "node",
      "scripts/check-frontend-gate-handoff.mjs"
    ],
    "reason": "Keep cross-plan Beta handoff synchronized without claiming target or formal acceptance"
  },
  {
    "id": "cancel",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "--test",
      "x04_oms",
      "x04_signed_cancel_remains_available_after_expiry_and_kill_and_replays_once",
      "--",
      "--exact",
      "--nocapture"
    ],
    "reason": "Changed internal submit key must preserve existing X04 order/cancel association, risk-reducing cancellation and one-call replay"
  },
  {
    "id": "cancel-control",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "--test",
      "x04_oms",
      "x04_cancel_control_rejects_forgery_scope_revocation_unknown_and_other_consumer",
      "--",
      "--exact",
      "--nocapture"
    ],
    "reason": "Changed signed dispatcher path must preserve cancel authority/scope/consumer refusal; no broad X04 event campaign"
  },
  {
    "id": "paper",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "execution-gateway",
      "--test",
      "x04_process",
      "x04_real_process_submits_cancels_and_audits_terminal_rejection",
      "--",
      "--exact",
      "--nocapture"
    ],
    "reason": "Submit key now opaque: verify the actual owned Paper stdio process still submits/cancels/replays and audits terminal rejection"
  }
];
checks.push({id:'rust-format',command:['rustfmt','--edition','2024','--check','crates/quantos-execution/tests/tp12_boundary.rs','crates/quantos-execution/src/dispatch.rs'],reason:'Formatting of the changed signed dispatcher and new boundary test only; no whole-workspace formatting'});
checks.push({id:'rust-lint',command:['cargo','clippy','--locked','--offline','-p','quantos-execution','--test','tp12_boundary','--','-D','warnings'],reason:'Compile/static analysis of the new signed-dispatch boundary test and its direct dependencies only'});
export function commands(){return checks.map(c=>({...c,timeoutMs:c.command[0]==='cargo'?900000:300000}));}
export function snapshot(){
 const runtime=JSON.parse(execFileSync('python3',['scripts/tp12-boundary-review.py','--inputs'],{cwd:root,encoding:'utf8'}));
 const selectors=[...runtime,'AGENTS.md','Makefile','rust-toolchain.toml','crates/quantos-execution/README.md','engines/pyproject.toml','third_party/nautilus-agents/','third_party/nautilus-trader/baseline.lock.json','proto/','scripts/tp12-*','scripts/tests/test_tp12_*.py','scripts/record-tp12-local.mjs','scripts/tp07-evaluation.py','scripts/provider-a1-receipts.mjs','scripts/provider-a1-policy.json','scripts/development-testing-policy.json','scripts/development-plan-order-policy.json','scripts/check-development-plan-order.mjs','scripts/check-development-plans.mjs','scripts/development-plan-order-negative.mjs','scripts/*gate-handoff*','docs/operations/tp12_nautilus_agents_','docs/adr/20261017-tp12-x3-boundary-review.md','docs/operations/tp12-local-admission.md','docs/operations/phased-testing.md','engines/tests/conftest.py','engines/tests/test_tp12_*.py','engines/tests/test_trading_agents_*.py','engines/tests/engine_contract_harness.py','crates/quantos-execution/tests/x03_authority.rs','crates/quantos-execution/tests/tp07_dispatch.rs','crates/quantos-execution/tests/tp12_boundary.rs','crates/quantos-execution/tests/x04_oms.rs','services/execution-gateway/tests/','crates/quantos-execution/tests/support/','crates/quantos-strategy/tests/support/','crates/quantos-reconcile/tests/','crates/quantos-runtime/tests/'];
 // Prefix globs are explicit; input enumeration never schedules a dependency gate.
 selectors[selectors.indexOf('docs/operations/tp12_nautilus_agents_')]='docs/operations/tp12_nautilus_agents_*.md';
 const inputs=inventory(selectors),normative=planInput(nodesFromPlans().get('CORE:TP12'));
 return {schema:'quantos-tp12-functional-inputs/v1',inputs,runtimeInputs:runtime,planInput:normative,checks,testingPolicy,inputDigest:digest(JSON.stringify({inputs,runtime,normative,checks,testingPolicy}))};
}
export function environment(base=process.env){const allowed=new Set(['PATH','HOME','TMPDIR','LANG','LC_ALL','RUSTUP_HOME','CARGO_HOME']);return {...staticEnvironment(Object.fromEntries(Object.entries(base).filter(([k])=>allowed.has(k)))),CARGO_NET_OFFLINE:'true',UV_OFFLINE:'1',npm_config_offline:'true',QUANTOS_RELEASE_PERFORMANCE:'0'};}
export function validateScope(){assert.equal(testingPolicy.development.defaultScope,'FUNCTION_AND_IMPACT');assert.equal(testingPolicy.development.recursiveDependencyRevalidation,false);assert(checks.every(c=>c.reason.length>20));assert(!checks.some(c=>c.command.includes('--workspace')||c.id.includes('reproducibility')));return true;}
