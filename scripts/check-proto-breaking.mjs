import {execFileSync} from 'node:child_process';
import path from 'node:path';
const root = process.env.QUANTOS_GATE_ROOT ?? process.cwd();
const git = args => execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
// CI supplies the PR base, push before, or explicit manual baseline.
// A manual baseline must be a full ancestor SHA; never silently compare HEAD.
const requested = process.env.QUANTOS_PROTO_BASE ?? (process.env.CI ? '' : 'HEAD^');
if (!requested || /^0+$/.test(requested)) throw new Error('Missing trusted proto baseline');
if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' && !/^[a-f0-9]{40}$/.test(requested)) {
  throw new Error('Manual proto baseline must be a full SHA');
}
const baseline = git(['rev-parse','--verify',`${requested}^{commit}`]);
if (baseline === git(['rev-parse','HEAD'])) throw new Error('Proto baseline must differ from HEAD');
if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
  git(['merge-base', '--is-ancestor', baseline, 'HEAD']);
}
execFileSync(process.env.BUF_BIN ?? path.resolve(new URL('../node_modules/.bin/buf',import.meta.url).pathname), ['breaking','--against',`.git#ref=${baseline}`],{cwd:root,stdio:'inherit'});
console.log(`Proto compatibility checked against ${baseline}`);
