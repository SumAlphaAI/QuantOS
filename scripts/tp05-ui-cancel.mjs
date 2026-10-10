import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),path=resolve(root,'artifacts/tp05-development/ui-cancel.json');
const r=JSON.parse(readFileSync(path));assert.equal(r.status,'PASS');assert.equal(r.artifactDelta,0);assert(r.elapsedMs>=0&&r.elapsedMs<2000);assert.equal(r.grpcStatus,'CANCELLED');
const tested=spawnSync('pnpm',['--filter','@sumalpha/domain-ui','exec','vitest','run','tests/tp05-research-cancel.test.ts','--reporter','verbose'],{cwd:root,env:{...process.env,QUANTOS_TP05_UI_PROBE:path},encoding:'utf8',timeout:60000});const output=(tested.stdout??'')+(tested.stderr??'');process.stdout.write(output);assert.equal(tested.status,0);assert.match(output,/3 passed/);assert.match(output,/TP05_UI_CANCEL_PASS/);assert(!/\d+ skipped/.test(output),'explicit integration may not skip');console.log('TP05_UI_CANCEL_BRIDGE_PASS actual UDS response transcript, no deployed HTTP claim');
