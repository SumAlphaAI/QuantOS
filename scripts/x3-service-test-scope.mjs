// Current feature and justified direct regressions. Enumeration does not schedule upstream gates.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,relative,dirname} from 'node:path';
import {root,inventory,digest,nodesFromPlans,planInput,staticEnvironment} from './provider-a1-receipts.mjs';
export const testingPolicy=JSON.parse(readFileSync(resolve(root,'scripts/development-testing-policy.json')));
export const checks=[
  {
    "id": "aggregate",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "execution-gateway",
      "--test",
      "x3_service",
      "--",
      "--nocapture"
    ],
    "reason": "Current aggregate: actual X03/Paper/operations/X01 versus independent Shadow, twenty-class proof/repair/reopen, concurrent dedupe and local recovery, kill and stale current sources"
  },
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
    "reason": "Direct service aggregate constituent exercised on current source: Current service authorization, signed evidence chain, SoD, concurrency, source CAS, uncertainty and controlled recovery"
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
    "reason": "Direct service aggregate constituent exercised on current source: Actual owned Paper stdio process: immediate/resting orders, fills, cancel replay and local-instance recovery without new IO"
  },
  {
    "id": "adapter",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-reconcile",
      "--test",
      "x05_sources",
      "--",
      "--nocapture"
    ],
    "reason": "Actual changed X04/X01 read adapter: source integrity, Decimal book accounting, marked basis and foreign-fee refusal; no X05 task gate"
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
    "reason": "Current aggregate authority boundary: Shared dispatcher submit refactor: all eight directly affected current-risk, approval, kill, dedupe and uncertainty tests"
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
    "reason": "Current aggregate authority boundary: Preserve authority stripping and opaque downstream identity while adding controlled service entry"
  },
  {
    "id": "no-submit",
    "command": [
      "python3",
      "scripts/check-x05-no-submit.py"
    ],
    "reason": "Reconciliation and Shadow production modules and replay_facts must have no submit/cancel/issuer/credential/network authority"
  },
  {
    "id": "runtime-exclusion",
    "command": [
      "python3",
      "scripts/tp12-boundary-review.py"
    ],
    "reason": "Cargo graph changed: static runtime-exclusion scan only; no TP12 full suite or recursive upstream revalidation"
  },
  {
    "id": "api-prohibitions",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-reconcile",
      "--doc"
    ],
    "reason": "Compiler-enforced ShadowRunner has no submit API; no source or authority conversion into a venue command"
  },
  {
    "id": "lint",
    "command": [
      "cargo",
      "clippy",
      "--locked",
      "--offline",
      "-p",
      "execution-gateway",
      "--test",
      "x3_service",
      "--",
      "-D",
      "warnings"
    ],
    "reason": "Compile/static checks for new composition tests, modified read adapter and direct dependency tree only"
  },
  {
    "id": "format",
    "command": [
      "cargo",
      "fmt",
      "--check",
      "-p",
      "execution-gateway",
      "-p",
      "quantos-reconcile"
    ],
    "reason": "Format only the packages with current composition and read-adapter edits; no workspace formatting campaign"
  },
  {
    "id": "coverage",
    "command": [
      "node",
      "scripts/x3-service-coverage.mjs",
      "{attempt}/coverage/receipt.json"
    ],
    "reason": "LLVM actual aggregate execution must cover repaired fee parse/guard/refusal lines; whole-file metrics informational, branch and performance acceptance not claimed"
  },
  {
    "id": "gate-tests",
    "command": [
      "node",
      "--test",
      "scripts/x3-service-local-gate.test.mjs"
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
    "reason": "Direct plan-validator change for CORE-GATE:X3-SERVICE functional references must preserve 44 ordering and refusal cases"
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
    "reason": "Synchronize explicit CORE-GATE:X3-SERVICE target handoff with frontend Beta checkpoint and policy"
  }
];
export function commands(attempt='docs/audit/evidence/x3-service-local-20261018/function-attempt-99'){return checks.map(c=>({...c,command:c.command.map(s=>s.replace('{attempt}',attempt)),timeoutMs:c.id==='coverage'?1200000:c.command[0]==='cargo'?900000:300000}));}
export function snapshot(){
 const meta=JSON.parse(execFileSync('cargo',['metadata','--offline','--locked','--no-deps','--format-version','1'],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}));
 const packages=new Map(meta.packages.map(p=>[p.name,p])),seen=new Set();
 function visit(name,dev=false){const p=packages.get(name);if(!p||seen.has(name))return;seen.add(name);for(const d of p.dependencies)if(d.kind!=='dev'||dev)visit(d.name);}
 visit('quantos-operations',true);visit('execution-gateway',true);
 const selectors=[...seen].flatMap(n=>{const d=relative(root,dirname(packages.get(n).manifest_path));return [d+'/Cargo.toml',d+'/src/'];});
 selectors.push('Cargo.toml','Cargo.lock','AGENTS.md','Makefile','rust-toolchain.toml','crates/quantos-operations/README.md','crates/quantos-reconcile/README.md','crates/quantos-operations/tests/','crates/quantos-execution/tests/support/','crates/quantos-strategy/tests/support/','crates/quantos-execution/tests/tp07_dispatch.rs','crates/quantos-execution/tests/tp12_boundary.rs','crates/quantos-execution/tests/x03_authority.rs','crates/quantos-execution/tests/x04_oms.rs','services/execution-gateway/tests/service_x06_process.rs','services/execution-gateway/tests/x3_service.rs','services/execution-gateway/tests/fixtures/x3-service-golden.json','crates/quantos-reconcile/tests/x05_sources.rs','crates/quantos-reconcile/tests/support/','scripts/check-x05-no-submit.py','scripts/x3-service-*.mjs','scripts/record-x3-service-local.mjs','scripts/provider-a1-receipts.mjs','scripts/provider-a1-policy.json','scripts/development-testing-policy.json','scripts/development-plan-order-policy.json','scripts/check-development-plan-order.mjs','scripts/check-development-plans.mjs','scripts/development-plan-order-negative.mjs','scripts/*gate-handoff*','scripts/tp12-boundary-review.py','scripts/tp07-evaluation.py','third_party/nautilus-agents/','third_party/nautilus-trader/baseline.lock.json','docs/operations/x3-service-local-admission.md','docs/adr/20261018-x3-service-functional-admission.md','docs/operations/phased-testing.md');
 // Exclusion validator statically inventories all production manifests/loads, without running them.
 const runtime=JSON.parse(execFileSync('python3',['scripts/tp12-boundary-review.py','--inputs'],{cwd:root,encoding:'utf8'}));
 const inputs=inventory([...selectors,...runtime]),normative=planInput(nodesFromPlans().get('CORE-GATE:X3-SERVICE'));
 return {schema:'quantos-x3-service-functional-inputs/v1',inputs,runtimeInputs:runtime,planInput:normative,checks,testingPolicy,inputDigest:digest(JSON.stringify({inputs,normative,checks,testingPolicy}))};
}
export function environment(base=process.env){const allowed=new Set(['PATH','HOME','TMPDIR','LANG','LC_ALL','RUSTUP_HOME','CARGO_HOME']);return {...staticEnvironment(Object.fromEntries(Object.entries(base).filter(([k])=>allowed.has(k)))),CARGO_NET_OFFLINE:'true',UV_OFFLINE:'1',npm_config_offline:'true',QUANTOS_RELEASE_PERFORMANCE:'0'};}
export function validateScope(){assert.equal(testingPolicy.development.defaultScope,'FUNCTION_AND_IMPACT');assert.equal(testingPolicy.development.recursiveDependencyRevalidation,false);assert(checks.every(c=>c.reason.length>20));assert(!checks.some(c=>c.command.includes('--workspace')||c.id.includes('reproducibility')));return true;}
