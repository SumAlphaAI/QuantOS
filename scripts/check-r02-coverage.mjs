import assert from 'node:assert/strict';
import fs from 'node:fs';
export const productionFiles = ['lib.rs', 'pg.rs', 'snapshot.rs', 'supabase_storage.rs', 'wire.rs', 'provenance.rs'].map(n => 'crates/quantos-storage/src/' + n);
export function validateCoverage(report) {
  assert.equal(report.type, 'llvm.coverage.json.export');
  const files = report.data.flatMap(d => d.files);
  assert(!files.some(f => /\/tests\//.test(f.filename)), 'test source must be excluded');
  const rows = productionFiles.map(file => {
    const matches = files.filter(f => f.filename.endsWith('/' + file));
    assert.equal(matches.length, 1, `missing/duplicate ${file}`);
    const summary = matches[0].summary;
    for (const [metric, threshold] of [['lines', 90], ['regions', 85]]) {
      const m = summary[metric];
      assert(Number.isInteger(m.count) && m.count > 0 && Number.isInteger(m.covered) && m.covered >= 0 && m.covered <= m.count, `invalid ${file} ${metric}`);
      assert(m.covered / m.count * 100 >= threshold, `${file} ${metric} below ${threshold}%`);
    }
    return {file, lines: summary.lines, regions: summary.regions};
  });
  return {schema: 'quantos-r02-production-coverage/v1', result: 'PASS', testSourcesExcluded: true, files: rows};
}
if (process.argv[1]?.endsWith('check-r02-coverage.mjs')) console.log(JSON.stringify(validateCoverage(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))), null, 2));
