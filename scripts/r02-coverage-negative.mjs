import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCoverage, productionFiles} from './check-r02-coverage.mjs';
const report = () => ({type: 'llvm.coverage.json.export', data: [{files: productionFiles.map(f => ({filename: '/repo/' + f, summary: {lines: {count: 100, covered: 90}, regions: {count: 100, covered: 85}}}))}]});
test('production thresholds accept exact boundaries', () => assert.equal(validateCoverage(report()).result, 'PASS'));
for (const [name, change] of [
  ['missing file', r => r.data[0].files.pop()],
  ['duplicate file', r => r.data[0].files.push(r.data[0].files[0])],
  ['test inflation', r => r.data[0].files.push({filename: '/repo/tests/unit/snapshot.rs'})],
  ['line failure hidden by claimed percent', r => Object.assign(r.data[0].files[0].summary.lines, {covered: 89, percent: 100})],
  ['region failure', r => r.data[0].files[0].summary.regions.covered = 84],
  ['zero denominator', r => r.data[0].files[0].summary.lines.count = 0],
  ['invalid covered count', r => r.data[0].files[0].summary.lines.covered = 101],
]) test(name, () => {const r = report(); change(r); assert.throws(() => validateCoverage(r));});
