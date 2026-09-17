import {execFileSync} from 'node:child_process';
import path from 'node:path';
const root = process.env.QUANTOS_GATE_ROOT ?? process.cwd();
const git = args => execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
// CI must supply the PR base SHA / push before SHA. Locally compare the parent.
const requested = process.env.QUANTOS_PROTO_BASE ?? (process.env.CI ? '' : 'HEAD^');
if (!requested || /^0+$/.test(requested)) throw new Error('Missing trusted proto baseline');
const baseline = git(['rev-parse','--verify',`${requested}^{commit}`]);
if (baseline === git(['rev-parse','HEAD'])) throw new Error('Proto baseline must differ from HEAD');
execFileSync(process.env.BUF_BIN ?? path.resolve(new URL('../node_modules/.bin/buf',import.meta.url).pathname), ['breaking','--against',`.git#ref=${baseline}`],{cwd:root,stdio:'inherit'});
console.log(`Proto compatibility checked against ${baseline}`);
