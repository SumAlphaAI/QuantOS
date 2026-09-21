// Used only by the clean-SHA database and target acceptance Gates.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function run(args, env = {}) {
  const result = spawnSync('cargo', args, { cwd: root, env: { ...process.env, ...env }, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`cargo ${args.join(' ')} failed`);
}
const branch = () => process.env.QUANTOS_F05_BRANCH === '1';
const coverageArgs = () => branch() ? ['--branch'] : [];
module.exports = {
  start() {
    for (const name of ['coverage.json', 'coverage-summary.json']) fs.rmSync(path.join(root, 'artifacts/f05', name), { force: true });
    run(['llvm-cov', 'clean', '--workspace']);
  },
  tests(packageName, databaseUrl) {
    run(['llvm-cov', '--no-report', ...coverageArgs(), '-p', packageName, '--lib', '--test', 'postgres_persistence', ...(packageName === 'quantos-storage' ? ['--test', 'storage_http'] : []), '--locked', '--', '--test-threads=1', '--nocapture'], { DATABASE_URL: databaseUrl, QUANTOS_RUN_F05_POSTGRES_TESTS: '1' });
  },
  storageLive() {
    run(['llvm-cov', '--no-report', ...coverageArgs(), '-p', 'quantos-storage', '--test', 'supabase_storage_integration', '--locked', '--', '--nocapture'], { QUANTOS_RUN_SUPABASE_STORAGE_TESTS: '1' });
  },
  finish() {
    const output = 'artifacts/f05/coverage.json';
    run(['llvm-cov', 'report', '-p', 'quantos-event', '-p', 'quantos-storage', '--json', '--output-path', output]);
    const result = spawnSync(process.execPath, ['scripts/check-f05-coverage.mjs', output, ...(branch() ? ['--branch'] : [])], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || 'F05 coverage failed');
    const summary = JSON.parse(result.stdout);
    fs.writeFileSync(path.join(root, 'artifacts/f05/coverage-summary.json'), JSON.stringify(summary, null, 2) + '\n');
    return summary;
  },
};
