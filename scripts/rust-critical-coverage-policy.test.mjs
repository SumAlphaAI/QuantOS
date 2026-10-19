import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCriticalCoverageRecipe } from './rust-critical-coverage-policy.mjs';
const current = readFileSync(new URL('../Makefile', import.meta.url), 'utf8');
test('critical coverage runs existing process consumers without changing reported production scope', () => {
  assert.deepEqual(validateCriticalCoverageRecipe(current).reportedPackages, ['quantos-core', 'quantos-risk', 'quantos-execution']);
});
for (const [name, from, to] of [
  ['fresh target wrapper removed', 'node scripts/with-fresh-coverage-target.mjs ', ''],
  ['consumer tests removed', '--package execution-gateway ', ''],
  ['line threshold lowered', '--fail-under-lines 90', '--fail-under-lines 80'],
  ['region threshold lowered', '--fail-under-regions 85', '--fail-under-regions 70'],
  ['first core report excluded', '--package quantos-core --all-features --release', '--package quantos-core --exclude-from-report quantos-core --all-features --release'],
  ['inline file exclusion added', '--exclude-from-report execution-gateway', '--exclude-from-report execution-gateway --ignore-filename-regex=guard.rs'],
  ['critical code excluded', '--exclude-from-report execution-gateway', '--exclude-from-report quantos-execution'],
  ['extra tested lines dilute the denominator', '--exclude-from-report execution-gateway', ''],
  ['file exclusion added', '--exclude-from-report execution-gateway', '--exclude-from-report execution-gateway --ignore-filename-regex process_kernel.rs'],
  ['old profiles borrowed', '--exclude-from-report execution-gateway', '--exclude-from-report execution-gateway --no-clean'],
]) test(`${name} is rejected`, () => {
  assert(current.includes(from));
  assert.throws(() => validateCriticalCoverageRecipe(current.replace(from, to)));
});
