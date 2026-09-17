// The same causal-control suite runs locally and in CI. Real database mutations
// are separately mandatory in f02-db-check; a tool crash is never a passing probe.
import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--test','scripts/f01-gate-negative.mjs','scripts/f02-gate-negative.mjs'],{stdio:'inherit',env:process.env});
process.exit(result.status??1);
