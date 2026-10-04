// Prefer the active pinned Node's package-manager shim over unrelated global pnpm versions.
// No global installation, package-manager downgrade, or lockfile mutation.
const fs = require('node:fs'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const expectedNode = fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim();
const expectedPnpm = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).packageManager.split('@').at(-1);
const [command, ...args] = process.argv.slice(2);
const env = { ...process.env, PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH };
if (process.versions.node !== expectedNode || !command) { console.error('PINNED_TOOLCHAIN_NODE_OR_COMMAND'); process.exitCode = 1; }
else {
  const version = spawnSync('pnpm', ['--version'], { cwd: root, env, encoding: 'utf8' });
  if (version.status !== 0 || version.stdout.trim() !== expectedPnpm) { console.error('PINNED_TOOLCHAIN_PNPM'); process.exitCode = 1; }
  else { const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' }); process.exitCode = result.status ?? 1; }
}
