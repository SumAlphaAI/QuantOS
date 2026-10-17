// Current feature and justified direct regressions. Enumeration does not schedule upstream gates.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,relative,dirname} from 'node:path';
import {root,inventory,digest,nodesFromPlans,planInput,staticEnvironment} from './provider-a1-receipts.mjs';
export const testingPolicy=JSON.parse(readFileSync(resolve(root,'scripts/development-testing-policy.json')));
export const checks=[
  {
    "id": "flow",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-operations",
      "--test",
      "service_x06",
      "--",
      "--nocapture"
    ],
    "reason": "Current service authorization, signed evidence chain, SoD, concurrency, source CAS, uncertainty and controlled recovery"
  },
  {
    "id": "native",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "execution-gateway",
      "--test",
      "service_x06_process",
      "--",
      "--nocapture"
    ],
    "reason": "Actual owned Paper stdio process: immediate/resting orders, fills, cancel replay and local-instance recovery without new IO"
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
    "reason": "Shared dispatcher submit refactor: all eight directly affected current-risk, approval, kill, dedupe and uncertainty tests"
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
    "reason": "Preserve authority stripping and opaque downstream identity while adding controlled service entry"
  },
  {
    "id": "risk-atomicity",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "--test",
      "x03_authority",
      "x03_risk_lock_kill_linearization_and_other_issuer_cannot_double_consume",
      "--",
      "--exact",
      "--nocapture"
    ],
    "reason": "Risk/issuer identity helpers and gateway anchor CAS must retain kill linearization and atomic unique approval consumption"
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
    "reason": "New service evidence/control helpers must retain current scope, forgery, revocation and consumer cancellation refusal"
  },
  {
    "id": "cancel-facts",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "--test",
      "x04_oms",
      "x04_replay_rejects_rehashed_illegal_order_and_cancel_facts",
      "--",
      "--exact",
      "--nocapture"
    ],
    "reason": "Allowing late valid uncertain-to-terminal facts must still reject rehashed illegal cancellation transitions"
  },
  {
    "id": "cancel-uncertain",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "--test",
      "x04_oms",
      "x04_uncertain_missing_or_uncorrelated_cancel_is_audited_without_retry",
      "--",
      "--exact",
      "--nocapture"
    ],
    "reason": "Late receipt support must preserve refusal of absent/mismatched cancel acknowledgement without duplicate IO"
  },
  {
    "id": "cancel-replay",
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
    "reason": "Late-cancel recovery changes apply_cancel and blocked-cancel release; retain valid cancellation and one-call replay"
  },
  {
    "id": "api-prohibitions",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-operations",
      "--doc"
    ],
    "reason": "Three compiler-enforced prohibitions: no ledger adjustment API and no client deserialization of MFA or checkpoint anchors"
  },
  {
    "id": "lint",
    "command": [
      "cargo",
      "clippy",
      "--locked",
      "--offline",
      "-p",
      "quantos-operations",
      "--all-targets",
      "--",
      "-D",
      "warnings"
    ],
    "reason": "Compile and static analysis for the new current service, tests and direct library dependency tree"
  },
  {
    "id": "native-lint",
    "command": [
      "cargo",
      "clippy",
      "--locked",
      "--offline",
      "-p",
      "execution-gateway",
      "--test",
      "service_x06_process",
      "--",
      "-D",
      "warnings"
    ],
    "reason": "Static validation of the actual owned Paper process consumer and shared fixture"
  },
  {
    "id": "format",
    "command": [
      "cargo",
      "fmt",
      "--check",
      "-p",
      "quantos-operations",
      "-p",
      "quantos-execution",
      "-p",
      "quantos-risk",
      "-p",
      "execution-gateway"
    ],
    "reason": "Formatting of current service and packages touched by instance/scope and anchored dispatcher helpers only"
  },
  {
    "id": "coverage",
    "command": [
      "node",
      "scripts/service-x06-coverage.mjs",
      "{attempt}/coverage/receipt.json"
    ],
    "reason": "LLVM instrumentation of current service: each model/service/telemetry file requires >=90% lines and >=85% regions; no branch coverage claim"
  },
  {
    "id": "gate-tests",
    "command": [
      "node",
      "--test",
      "scripts/service-x06-local-gate.test.mjs"
    ],
    "reason": "Negative admission for changed source/commands/logs, empty tests, phase promotion, unsafe paths, target flags and atomic publication rollback"
  },
  {
    "id": "plan-policy",
    "command": [
      "node",
      "--test",
      "scripts/development-plan-order-negative.mjs"
    ],
    "reason": "Direct plan-validator change for SERVICE:X06 functional references must preserve 44 ordering and refusal cases"
  },
  {
    "id": "plans",
    "command": [
      "node",
      "scripts/check-development-plans.mjs"
    ],
    "reason": "Both plans and registered stage contract must agree without granting upstream readiness"
  },
  {
    "id": "core-handoff",
    "command": [
      "node",
      "scripts/check-development-gate-handoff.mjs"
    ],
    "reason": "Keep existing core target obligations and staging scope unchanged while adding current service notes"
  },
  {
    "id": "frontend-handoff",
    "command": [
      "node",
      "scripts/check-frontend-gate-handoff.mjs"
    ],
    "reason": "Synchronize explicit SERVICE:X06 target handoff with frontend Beta checkpoint and policy"
  },
  {
    "id": "runtime-exclusion",
    "command": [
      "python3",
      "scripts/tp12-boundary-review.py"
    ],
    "reason": "Cargo graph changed: static runtime-exclusion scan only; no TP12 full suite or recursive upstream revalidation"
  }
];
export function commands(attempt='docs/audit/evidence/service-x06-local-20261017/function-attempt-99'){return checks.map(c=>({...c,command:c.command.map(s=>s.replace('{attempt}',attempt)),timeoutMs:c.id==='coverage'?1200000:c.command[0]==='cargo'?900000:300000}));}
export function snapshot(){
 const meta=JSON.parse(execFileSync('cargo',['metadata','--offline','--locked','--no-deps','--format-version','1'],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}));
 const packages=new Map(meta.packages.map(p=>[p.name,p])),seen=new Set();
 function visit(name,dev=false){const p=packages.get(name);if(!p||seen.has(name))return;seen.add(name);for(const d of p.dependencies)if(d.kind!=='dev'||dev)visit(d.name);}
 visit('quantos-operations',true);visit('execution-gateway',true);
 const selectors=[...seen].flatMap(n=>{const d=relative(root,dirname(packages.get(n).manifest_path));return [d+'/Cargo.toml',d+'/src/'];});
 selectors.push('Cargo.toml','Cargo.lock','AGENTS.md','Makefile','rust-toolchain.toml','crates/quantos-operations/README.md','crates/quantos-operations/tests/','crates/quantos-execution/tests/support/','crates/quantos-strategy/tests/support/','crates/quantos-execution/tests/tp07_dispatch.rs','crates/quantos-execution/tests/tp12_boundary.rs','crates/quantos-execution/tests/x03_authority.rs','crates/quantos-execution/tests/x04_oms.rs','services/execution-gateway/tests/service_x06_process.rs','scripts/service-x06-*.mjs','scripts/record-service-x06-local.mjs','scripts/provider-a1-receipts.mjs','scripts/provider-a1-policy.json','scripts/development-testing-policy.json','scripts/development-plan-order-policy.json','scripts/check-development-plan-order.mjs','scripts/check-development-plans.mjs','scripts/development-plan-order-negative.mjs','scripts/*gate-handoff*','scripts/tp12-boundary-review.py','scripts/tp07-evaluation.py','third_party/nautilus-agents/','third_party/nautilus-trader/baseline.lock.json','docs/operations/service-x06.md','docs/adr/20261017-service-x06-controlled-operations.md','docs/operations/phased-testing.md');
 // Exclusion validator statically inventories all production manifests/loads, without running them.
 const runtime=JSON.parse(execFileSync('python3',['scripts/tp12-boundary-review.py','--inputs'],{cwd:root,encoding:'utf8'}));
 const inputs=inventory([...selectors,...runtime]),normative=planInput(nodesFromPlans().get('SERVICE:X06'));
 return {schema:'quantos-service-x06-functional-inputs/v1',inputs,runtimeInputs:runtime,planInput:normative,checks,testingPolicy,inputDigest:digest(JSON.stringify({inputs,normative,checks,testingPolicy}))};
}
export function environment(base=process.env){const allowed=new Set(['PATH','HOME','TMPDIR','LANG','LC_ALL','RUSTUP_HOME','CARGO_HOME']);return {...staticEnvironment(Object.fromEntries(Object.entries(base).filter(([k])=>allowed.has(k)))),CARGO_NET_OFFLINE:'true',UV_OFFLINE:'1',npm_config_offline:'true',QUANTOS_RELEASE_PERFORMANCE:'0'};}
export function validateScope(){assert.equal(testingPolicy.development.defaultScope,'FUNCTION_AND_IMPACT');assert.equal(testingPolicy.development.recursiveDependencyRevalidation,false);assert(checks.every(c=>c.reason.length>20));assert(!checks.some(c=>c.command.includes('--workspace')||c.id.includes('reproducibility')));return true;}
