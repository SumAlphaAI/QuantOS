// Development scope is selected by actual changes, never by recursive task graph closure.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {root,inventory,digest,nodesFromPlans,planInput,staticEnvironment} from './provider-a1-receipts.mjs';
export const testingPolicy=JSON.parse(readFileSync(resolve(root,'scripts/development-testing-policy.json')));
export const checks=[
  {
    "id": "x05-flow",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-reconcile",
      "--test",
      "x05_flow",
      "--",
      "--nocapture"
    ],
    "reason": "Shadow risk observations, virtual ledger/idempotency, all 20 differences, scoped CAS exceptions and anchored recovery"
  },
  {
    "id": "x05-sources",
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
    "reason": "Read-only X03 Command/X04 fact replay/X01 validated snapshot adapter plus independent long/short accounting golden values"
  },
  {
    "id": "x05-process",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-reconcile",
      "--test",
      "x05_process",
      "--",
      "--nocapture"
    ],
    "reason": "New native supplied-data reconciliation worker: 20 differences and strict bounded protocol refuses submit/unknown/malformed frames"
  },
  {
    "id": "x05-compat",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-reconcile",
      "--lib",
      "--bins"
    ],
    "reason": "Moved legacy fixture APIs remain compatible; no upstream runtime was modified or revalidated"
  },
  {
    "id": "no-submit",
    "command": [
      "python3",
      "scripts/check-x05-no-submit.py"
    ],
    "reason": "Verify new production module call boundaries have no venue submit/issuer/network/DB/secret path and use only read-only X04 replay"
  },
  {
    "id": "interface",
    "command": [
      "cargo",
      "test",
      "--locked",
      "--offline",
      "-p",
      "quantos-reconcile",
      "--doc"
    ],
    "reason": "Compile-fail contract proves ShadowRunner does not expose a submit method"
  },
  {
    "id": "compile",
    "command": [
      "cargo",
      "check",
      "--locked",
      "--offline",
      "-p",
      "quantos-reconcile",
      "--all-targets"
    ],
    "reason": "Compile the affected reconciliation package, native worker and direct local dependency edges"
  },
  {
    "id": "clippy",
    "command": [
      "cargo",
      "clippy",
      "--locked",
      "--offline",
      "-p",
      "quantos-reconcile",
      "--all-targets",
      "--",
      "-D",
      "warnings"
    ],
    "reason": "Static analysis of the changed reconciliation modules, worker and tests"
  },
  {
    "id": "format",
    "command": [
      "cargo",
      "fmt",
      "-p",
      "quantos-reconcile",
      "--",
      "--check"
    ],
    "reason": "Formatting of the changed reconciliation package only"
  },
  {
    "id": "coverage",
    "command": [
      "node",
      "scripts/x05-coverage.mjs"
    ],
    "reason": "Instrument five new production files and enforce line >=90 and region >=85 per file"
  },
  {
    "id": "x05-local-policy",
    "command": [
      "node",
      "--test",
      "scripts/x05-local-gate.test.mjs"
    ],
    "reason": "Function-only source/evidence/no-submit/20-class proof and refusal/publication rollback Gate checks"
  },
  {
    "id": "plan-policy",
    "command": [
      "node",
      "--test",
      "scripts/development-plan-order-negative.mjs"
    ],
    "reason": "Changed X05 local reference-only receipt registration must preserve scheduling and all plan refusal rules"
  },
  {
    "id": "plans",
    "command": [
      "node",
      "scripts/check-development-plans.mjs"
    ],
    "reason": "Both plans and their stage/dependency/handoff contract were updated for X05"
  },
  {
    "id": "core-handoff",
    "command": [
      "node",
      "scripts/check-development-gate-handoff.mjs"
    ],
    "reason": "Retain real 10 trading-day Shadow, 20 classes within 15 minutes and deployment/release target obligations"
  },
  {
    "id": "frontend-handoff",
    "command": [
      "node",
      "scripts/check-frontend-gate-handoff.mjs"
    ],
    "reason": "Keep cross-plan release obligations aligned after adding X05 local development admission"
  }
];
export function commands(attempt){return checks.map(c=>({...c,timeoutMs:c.id==='coverage'?1200000:900000,command:c.id==='coverage'?[...c.command,attempt+'/coverage/receipt.json']:c.command}));}
export function snapshot(){
 // Hash the actual local compile dependency tree. Hashing inputs does not execute their task gates.
 const metadata=JSON.parse(execFileSync('cargo',['metadata','--offline','--locked','--no-deps','--format-version','1'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}));
 const packages=new Map(metadata.packages.map(p=>[p.name,p])),selected=new Set();
 function visit(name){if(selected.has(name))return;const p=packages.get(name);if(!p)return;selected.add(name);for(const d of p.dependencies)if(d.path)visit(d.name);}
 visit('quantos-reconcile');
 const selectors=["Makefile","AGENTS.md","Cargo.toml","Cargo.lock","rust-toolchain.toml","docs/operations/phased-testing.md","docs/operations/x05-local-admission.md","docs/adr/20261017-x05-shadow-reconciliation.md","crates/quantos-reconcile/README.md","scripts/development-testing-policy.json","scripts/x05-*","scripts/record-x05-local.mjs","scripts/check-x05-no-submit.py","scripts/x04-*","scripts/tp07-*","scripts/provider-a1-policy.json","scripts/provider-a1-receipts.mjs","scripts/check-development-plan-order.mjs","scripts/development-plan-order-policy.json","scripts/check-development-plans.mjs","scripts/development-plan-order-negative.mjs","scripts/check-development-gate-handoff.mjs","scripts/check-frontend-gate-handoff.mjs","scripts/development-gate-handoff-policy.json","scripts/frontend-gate-handoff-policy.json"];
 for(const name of selected){const p=packages.get(name),directory=p.manifest_path.slice(root.length+1).replace(/Cargo.toml$/,'');selectors.push(directory+'Cargo.toml',directory+'src/');}
 selectors.push('crates/quantos-reconcile/tests/','crates/quantos-execution/tests/support/','crates/quantos-strategy/tests/support/');
 const inputs=inventory(selectors),normative=planInput(nodesFromPlans().get('CORE:X05'));
 return {schema:'quantos-x05-functional-inputs/v1',inputs,planInput:normative,checks,testingPolicy,inputDigest:digest(JSON.stringify({inputs,normative,checks,testingPolicy}))};
}
export function environment(base=process.env){return {...staticEnvironment(base),CARGO_NET_OFFLINE:'true',UV_OFFLINE:'1',npm_config_offline:'true',QUANTOS_RELEASE_PERFORMANCE:'0'};}
export function validateScope(){assert.equal(testingPolicy.development.defaultScope,'FUNCTION_AND_IMPACT');assert.equal(testingPolicy.development.recursiveDependencyRevalidation,false);assert(checks.every(c=>c.reason.length>20));assert(!checks.some(c=>c.command.includes('--workspace')||c.id.includes('reproducibility')));return true;}
