import assert from 'node:assert/strict';

export function validateCriticalCoverageRecipe(makefile) {
  const recipe = makefile.match(/^coverage-rust:\n((?:\t.*\n)+)/m)?.[1];
  assert(recipe, 'critical coverage recipe missing');
  const commands = recipe.trim().split('\n').map(line => line.trim().split(/\s+/));
  assert.deepEqual(commands[1]?.slice(0, 2), ['node', 'scripts/with-fresh-coverage-target.mjs'], 'critical coverage needs fresh objects and profiles');
  commands[1] = commands[1].slice(2);
  assert.equal(commands.length, 2, 'core release and combined critical reports remain mandatory');
  const values = (args, option) => args.flatMap((arg, i) => arg === option ? [args[i + 1]] : []);
  for (const args of commands) {
    assert.deepEqual(args.slice(0, 2), ['cargo', 'llvm-cov']);
    assert.deepEqual(values(args, '--fail-under-lines'), ['90']);
    assert(args.includes('--all-features'));
    assert(!args.some(arg => ['--ignore-filename-regex', '--no-report', '--exclude', '--exclude-from-test', '--no-clean'].includes(arg.split('=')[0])), 'coverage cannot hide critical source or borrow old profiles');
  }
  assert.deepEqual(values(commands[0], '--package'), ['quantos-core']);
  assert(commands[0].includes('--release'));
  assert.deepEqual(values(commands[0], '--exclude-from-report'), []);
  assert.deepEqual(values(commands[0], '--fail-under-regions'), ['90']);
  assert.deepEqual(values(commands[1], '--package'), ['quantos-core', 'quantos-risk', 'quantos-execution', 'execution-gateway']);
  assert.deepEqual(values(commands[1], '--exclude-from-report'), ['execution-gateway']);
  assert.deepEqual(values(commands[1], '--fail-under-regions'), ['85']);
  return { reportedPackages: ['quantos-core', 'quantos-risk', 'quantos-execution'], consumerTests: 'execution-gateway', lines: 90, regions: 85 };
}
