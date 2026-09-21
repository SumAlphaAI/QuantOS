#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) throw new Error('usage: check-f05-branch.mjs <llvm-cov-json>');
const report = JSON.parse(readFileSync(path, 'utf8'));
const branches = report?.data?.[0]?.totals?.branches;
if (!branches || !Number.isFinite(branches.count) || branches.count <= 0) {
  throw new Error('F05 branch coverage report is missing measured branches');
}
const calculated = branches.covered / branches.count * 100;
if (!Number.isFinite(branches.percent) || Math.abs(branches.percent - calculated) > 0.01) {
  throw new Error('F05 branch coverage percentage does not match covered/count');
}
if (calculated < 85) {
  throw new Error(`F05 branch coverage ${calculated.toFixed(2)}% is below 85% (${branches.covered}/${branches.count})`);
}
console.log(`F05 branch coverage PASS: ${calculated.toFixed(2)}% (${branches.covered}/${branches.count})`);
