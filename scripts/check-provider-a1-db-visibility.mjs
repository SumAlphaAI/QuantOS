import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const run=spawnSync('cargo',['test','-p','bff-gateway','--lib','real_logout_db_write_matches_persistent_trace','--locked','--offline','--','--ignored'],{encoding:'utf8',env:{...process.env,QUANTOS_RUN_F09_POSTGRES_TESTS:'0'}});
const log=(run.stdout??'')+(run.stderr??'');
assert(run.status!==0&&log.includes('explicit Supabase target test requires QUANTOS_RUN_F09_POSTGRES_TESTS=1')&&log.includes('1 failed'),'explicit target run without opt-in must fail before DB connection');
console.log('PASS target test is ignored by default and requires explicit target opt-in; database NOT_RUN');
