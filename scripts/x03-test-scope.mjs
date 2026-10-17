// Development scope is selected by actual changes, never by recursive task graph closure.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {root,inventory,digest,nodesFromPlans,planInput,staticEnvironment} from './provider-a1-receipts.mjs';
export const testingPolicy=JSON.parse(readFileSync(resolve(root,'scripts/development-testing-policy.json')));
export const checks=[
 {id:'x03-rust',command:['cargo','test','--locked','--offline','-p','quantos-execution','--test','x03_authority'],reason:'X03 authority: real R04/X01/S03/F06 types, atomic risk/approval, replay, refusal, rollback and 1000 tasks'},
 {id:'x03-compat',command:['cargo','test','--locked','--offline','-p','quantos-execution','-p','quantos-risk','-p','quantos-evidence','--lib'],reason:'Changed authority exports and shared RiskGuard must preserve existing execution/risk/evidence consumers'},
 {id:'x02-regression',command:['cargo','test','--locked','--offline','-p','quantos-risk','--test','x02_guard'],reason:'RiskGuard current-Allow and kill mutex implementation changed; preserve all existing X02 API cases'},
 {id:'compile',command:['cargo','check','--locked','--offline','-p','quantos-execution','--all-targets'],reason:'Public issuer API and new local dependency edges must compile'},
 {id:'clippy',command:['cargo','clippy','--locked','--offline','-p','quantos-execution','-p','quantos-risk','--all-targets','--','-D','warnings'],reason:'Static check of the changed execution and risk crates'},
 {id:'format',command:['cargo','fmt','-p','quantos-execution','-p','quantos-risk','--','--check'],reason:'Formatting of changed Rust modules'},
 {id:'coverage',command:['node','scripts/x03-coverage.mjs'],reason:'Instrument new authority and shared guard; enforce development line and region coverage'},
 {id:'x03-local-policy',command:['node','--test','scripts/x03-local-gate.test.mjs'],reason:'Changed phase/gate recorder, evidence authenticity and publication rollback'},
 {id:'plan-policy',command:['node','--test','scripts/development-plan-order-negative.mjs','scripts/provider-a1-receipts.test.mjs'],reason:'Changed plan dependency receipt shape and removal of recursive X03 dispatch'},
 {id:'plans',command:['node','scripts/check-development-plans.mjs'],reason:'Both plans and machine contract must remain consistent'},
 {id:'core-handoff',command:['node','scripts/check-development-gate-handoff.mjs'],reason:'Keep all deferred target obligations and original performance goals'},
 {id:'frontend-handoff',command:['node','scripts/check-frontend-gate-handoff.mjs'],reason:'Cross-plan release obligations must remain consistent'},
];
export function commands(attempt){return checks.map(c=>({...c,timeoutMs:c.id==='coverage'?1200000:900000,command:c.id==='coverage'?[...c.command,attempt+'/coverage/receipt.json']:c.command}));}
export function snapshot(){
 // Hash the actual local compile dependency tree. Hashing inputs does not execute their task gates.
 const metadata=JSON.parse(execFileSync('cargo',['metadata','--offline','--locked','--no-deps','--format-version','1'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}));
 const packages=new Map(metadata.packages.map(p=>[p.name,p])),selected=new Set();
 function visit(name){if(selected.has(name))return;const p=packages.get(name);if(!p)return;selected.add(name);for(const d of p.dependencies)if(d.path)visit(d.name);}
 visit('quantos-execution');visit('quantos-evidence');
 const selectors=['Cargo.toml','Cargo.lock','rust-toolchain.toml','AGENTS.md','scripts/development-testing-policy.json','scripts/x03-*','scripts/record-x03-local.mjs','scripts/provider-a1-receipts.mjs','scripts/check-development-plan-order.mjs','scripts/development-plan-order-policy.json','scripts/check-development-plans.mjs','scripts/development-plan-order-negative.mjs','scripts/provider-a1-receipts.test.mjs'];
 for(const name of selected){const p=packages.get(name),directory=p.manifest_path.slice(root.length+1).replace(/Cargo.toml$/,'');selectors.push(directory+'Cargo.toml',directory+'src/');}
 selectors.push('crates/quantos-execution/tests/','crates/quantos-risk/tests/','crates/quantos-strategy/tests/support/');
 const inputs=inventory(selectors),normative=planInput(nodesFromPlans().get('CORE:X03'));
 return {schema:'quantos-x03-functional-inputs/v1',inputs,planInput:normative,checks,testingPolicy,inputDigest:digest(JSON.stringify({inputs,normative,checks,testingPolicy}))};
}
export function environment(base=process.env){return {...staticEnvironment(base),CARGO_NET_OFFLINE:'true',UV_OFFLINE:'1',npm_config_offline:'true',QUANTOS_RELEASE_PERFORMANCE:'0'};}
export function validateScope(){assert.equal(testingPolicy.development.defaultScope,'FUNCTION_AND_IMPACT');assert.equal(testingPolicy.development.recursiveDependencyRevalidation,false);assert(checks.every(c=>c.reason.length>20));assert(!checks.some(c=>c.command.includes('--workspace')||c.id.includes('reproducibility')));return true;}
