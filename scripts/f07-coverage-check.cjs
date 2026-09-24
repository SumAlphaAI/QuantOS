const fs = require('node:fs');
const path = require('node:path');

const filename = process.argv[2];
if (!filename) throw new Error('F07 coverage JSON path is required');
const report = JSON.parse(fs.readFileSync(filename, 'utf8'));
const files = report.data?.flatMap((part) => part.files ?? []) ?? [];
const names = [
  path.join('crates', 'quantos-runtime', 'src', 'lib.rs'),
  path.join('crates', 'quantos-runtime', 'src', 'pg.rs'),
  path.join('services', 'runtime-gateway', 'src', 'live.rs'),
];
const selected = names.map((name) => {
  const match = files.find((file) => file.filename.endsWith(name));
  if (!match) throw new Error(`F07 coverage missing ${name}`);
  return match;
});
function fraction(key) {
  const count = selected.reduce((sum, file) => sum + file.summary[key].count, 0);
  const covered = selected.reduce((sum, file) => sum + file.summary[key].covered, 0);
  if (count === 0) throw new Error(`F07 ${key} coverage has no samples`);
  return { count, covered, percent: covered * 100 / count };
}
const lines = fraction('lines');
const regions = fraction('regions');
const result = { schema: 'quantos-f07-coverage/v1', files: names, lines, regions };
if (process.env.QUANTOS_F07_NIGHTLY_BRANCH === '1') result.branches = fraction('branches');
console.log(JSON.stringify(result, null, 2));
if (lines.percent < 90 || regions.percent < 85 || (result.branches && result.branches.percent < 85)) {
  throw new Error('F07 Rust coverage below line 90%, region 85%, or nightly branch 85% threshold');
}
