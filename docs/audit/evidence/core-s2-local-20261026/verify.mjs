// Read-only verification, never executes engines, SQL or external actions.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verify,directory,files} from '../../../../scripts/core-s2-review.mjs';
import {hash} from '../../../../scripts/g1-download-review.mjs';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const receipt=json(directory+'/receipt.json'),result=verify(receipt);let passed=0,ignored=0;const names=[];
for(const id of ['strategy-domain','s04-tcp','risk-consumer','execution-consumer','worker-handoff','c05-c08']){const log=read(receipt.attempt+'/'+id+'.log').toString(),rows=[...log.matchAll(/test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored/g)];assert(rows.length);for(const row of rows){passed+=Number(row[1]);assert.equal(Number(row[2]),0);ignored+=Number(row[3]);}names.push(...[...log.matchAll(/^test (.+) \.\.\. ignored/gm)].map(m=>m[1]));}
assert.equal(passed,96);assert.equal(ignored,3);assert.deepEqual(names.sort(),['pg::release_row_tests::s03_legacy_null_workspace_returns_error_instead_of_panicking','tests::draft_saves_stay_under_three_hundred_millis_p95','tests::kill_switch_rejects_new_commands_under_one_second_p95'].sort());
const domain=read(receipt.attempt+'/strategy-domain.log').toString();for(const name of ['s2_domain_self_approval_is_rejected_without_mutating_the_candidate','s2_future_ticket_cannot_be_returned_or_consumed_before_issuance'])assert(domain.includes(name+' ... ok'));
const python=read(receipt.attempt+'/governance-python.log').toString();assert.match(python,/26 passed/);assert(!/FAILED|SKIPPED/.test(python));assert.match(read(receipt.attempt+'/gate-tests.log').toString(),/ℹ pass 223/);
const manifest=json(directory+'/manifest.json');assert.equal(manifest.sourceCommit,result.sourceCommit);assert.equal(manifest.gate,result.gate);assert.equal(manifest.formalAccepted,false);assert.deepEqual(manifest.files.map(f=>f.path),files(directory).filter(p=>p!==directory+'/manifest.json'));for(const f of manifest.files)assert.equal(hash(read(f.path)),f.sha256,f.path);
console.log(JSON.stringify({...result,rustPassed:passed,rustIgnored:ignored,pythonCases:26,nodeCases:223,nativeConfigurations:40,referenceAdrs:7,evidenceFiles:manifest.files.length+1}));
