#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const reportPath = process.argv[2] ?? 'target/f08-python-coverage.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const sourceRoots = [
  'engines/engine-sdk/sdk_src/quantos_engine_sdk',
  'engines/mock-engine/src/mock_engine',
];
const expected = sourceRoots.flatMap((directory) =>
  fs.readdirSync(directory)
    .filter((filename) => filename.endsWith('.py'))
    .map((filename) => path.posix.join(directory, filename)),
);
const result = [];
for (const filename of expected) {
  const entry = report.files?.[filename];
  if (!entry || !Number.isInteger(entry.summary?.num_statements)) {
    throw new Error(`F08 coverage missing source file: ${filename}`);
  }
  const total = entry.summary.num_statements;
  const covered = entry.summary.covered_lines;
  const percent = total === 0 ? 100 : (100 * covered) / total;
  result.push({ file: filename, covered, total, linePercent: Number(percent.toFixed(2)) });
  if (percent < 85) {
    throw new Error(`F08 line coverage below 85%: ${filename} ${percent.toFixed(2)}%`);
  }
}
console.log(JSON.stringify({ schema: 'quantos-f08-python-coverage/v1', status: 'PASS', files: result }, null, 2));
