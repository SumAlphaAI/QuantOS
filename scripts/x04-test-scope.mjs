// Development scope is selected by actual changes, never by recursive task graph closure.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {root,inventory,digest,nodesFromPlans,planInput,staticEnvironment} from './provider-a1-receipts.mjs';
export const testingPolicy=JSON.parse(readFileSync(resolve(root,'scripts/development-testing-policy.json')));
export const checks=[
  {
    "id": "x04-oms",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "--test",
      "x04_oms",
      "--",
      "--nocapture"
    ],
    "reason": "X04 order submit/cancel, signed control, append-only replay, Fill provenance, illegal batches and 100000 mixed events"
  },
  {
    "id": "x04-process",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "execution-gateway",
      "--test",
      "x04_process",
      "--",
      "--nocapture"
    ],
    "reason": "Changed native Paper resting/cancel protocol: real executable, correlation, timeout/crash and credential-free strict wire"
  },
  {
    "id": "tp07-dispatch",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "--test",
      "tp07_dispatch"
    ],
    "reason": "Changed gateway facts/event reducer and issuer require direct TP07 submit/risk/claim/kill regressions"
  },
  {
    "id": "tp07-process",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "execution-gateway",
      "--test",
      "tp07_process"
    ],
    "reason": "Paper protocol now accepts cancellation: preserve existing strict submit, framing and real process refusal behavior"
  },
  {
    "id": "tp07-compat",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "-p",
      "execution-gateway",
      "--lib",
      "--bins"
    ],
    "reason": "Changed gateway reducer, legacy state mutation safety, execution trait and service bootstrap require package compatibility tests"
  },
  {
    "id": "tp07-regression",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "--test",
      "x03_authority"
    ],
    "reason": "X04 order-control authorization shares the issuer: preserve X03 atomic issuance/approval/expiry invariants"
  },
  {
    "id": "compile",
    "command": [
      "cargo",
      "check",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "-p",
      "execution-gateway",
      "--all-targets"
    ],
    "reason": "Compile the changed core boundary and service with local dependency edges"
  },
  {
    "id": "clippy",
    "command": [
      "cargo",
      "clippy",
      "--locked",
      "--offline",
      "-p",
      "quantos-execution",
      "-p",
      "execution-gateway",
      "--all-targets",
      "--",
      "-D",
      "warnings"
    ],
    "reason": "Static analysis of changed execution/service source and tests"
  },
  {
    "id": "format",
    "command": [
      "cargo",
      "fmt",
      "-p",
      "quantos-execution",
      "-p",
      "execution-gateway",
      "--",
      "--check"
    ],
    "reason": "Formatting of the affected Rust packages"
  },
  {
    "id": "coverage",
    "command": [
      "node",
      "scripts/x04-coverage.mjs"
    ],
    "reason": "Instrument authority/gateway/dispatch/process code and enforce development coverage thresholds"
  },
  {
    "id": "x04-local-policy",
    "command": [
      "node",
      "--test",
      "scripts/x04-local-gate.test.mjs"
    ],
    "reason": "X04 function Gate evidence/source/100000 event/phase boundary/coverage/refusal/publication rollback checks"
  },
  {
    "id": "plan-policy",
    "command": [
      "node",
      "--test",
      "scripts/development-plan-order-negative.mjs"
    ],
    "reason": "Changed X04 reference-only receipt shape and machine contract must preserve dependency scheduling/refusal"
  },
  {
    "id": "plans",
    "command": [
      "node",
      "scripts/check-development-plans.mjs"
    ],
    "reason": "Both plans and the machine stage/dependency contract changed"
  },
  {
    "id": "core-handoff",
    "command": [
      "node",
      "scripts/check-development-gate-handoff.mjs"
    ],
    "reason": "Retain original target and performance obligations in the core plan"
  },
  {
    "id": "frontend-handoff",
    "command": [
      "node",
      "scripts/check-frontend-gate-handoff.mjs"
    ],
    "reason": "Keep cross-plan release obligations consistent"
  },
  {
    "id": "upstream-boundary",
    "command": [
      "python3",
      "scripts/tp07-evaluation.py"
    ],
    "reason": "Confirm pinned upstream remains evaluation-only and absent from runtime imports/locks after the owned process addition"
  }
];
export function commands(attempt){return checks.map(c=>({...c,timeoutMs:c.id==='coverage'?1200000:900000,command:c.id==='coverage'?[...c.command,attempt+'/coverage/receipt.json']:c.command}));}
export function snapshot(){
 // Hash the actual local compile dependency tree. Hashing inputs does not execute their task gates.
 const metadata=JSON.parse(execFileSync('cargo',['metadata','--offline','--locked','--no-deps','--format-version','1'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}));
 const packages=new Map(metadata.packages.map(p=>[p.name,p])),selected=new Set();
 function visit(name){if(selected.has(name))return;const p=packages.get(name);if(!p)return;selected.add(name);for(const d of p.dependencies)if(d.path)visit(d.name);}
 visit('quantos-execution');visit('execution-gateway');
 const selectors=['Makefile','docs/operations/x04-local-admission.md','docs/operations/phased-testing.md','docs/adr/20261017-x04-paper-oms-facts.md','scripts/provider-a1-policy.json','Cargo.toml','Cargo.lock','rust-toolchain.toml','AGENTS.md','scripts/development-testing-policy.json','scripts/x04-*','scripts/tp07-*','scripts/record-x04-local.mjs','scripts/provider-a1-receipts.mjs','scripts/check-development-plan-order.mjs','scripts/development-plan-order-policy.json','scripts/check-development-plans.mjs','scripts/development-plan-order-negative.mjs','scripts/tp07-evaluation.py','third_party/nautilus-trader/','scripts/check-development-gate-handoff.mjs','scripts/check-frontend-gate-handoff.mjs','scripts/development-gate-handoff-policy.json','scripts/frontend-gate-handoff-policy.json'];
 for(const name of selected){const p=packages.get(name),directory=p.manifest_path.slice(root.length+1).replace(/Cargo.toml$/,'');selectors.push(directory+'Cargo.toml',directory+'src/');}
 selectors.push('crates/quantos-execution/tests/','services/execution-gateway/tests/','crates/quantos-strategy/tests/support/');
 const inputs=inventory(selectors),normative=planInput(nodesFromPlans().get('CORE:X04'));
 return {schema:'quantos-x04-functional-inputs/v1',inputs,planInput:normative,checks,testingPolicy,inputDigest:digest(JSON.stringify({inputs,normative,checks,testingPolicy}))};
}
export function environment(base=process.env){return {...staticEnvironment(base),CARGO_NET_OFFLINE:'true',UV_OFFLINE:'1',npm_config_offline:'true',QUANTOS_RELEASE_PERFORMANCE:'0'};}
export function validateScope(){assert.equal(testingPolicy.development.defaultScope,'FUNCTION_AND_IMPACT');assert.equal(testingPolicy.development.recursiveDependencyRevalidation,false);assert(checks.every(c=>c.reason.length>20));assert(!checks.some(c=>c.command.includes('--workspace')||c.id.includes('reproducibility')));return true;}
