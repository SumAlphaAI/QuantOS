#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
function sources(dir) {
  return readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap(entry => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? sources(path) : entry.name.endsWith('.rs') ? [path] : [];
  });
}
export const requiredFiles = ['quantos-event', 'quantos-storage'].flatMap(name => sources(`crates/${name}/src`));
export function checkCoverage(report, requireBranches = false) {
  const files = report?.data?.flatMap(unit => unit.files ?? []) ?? [];
  const totals = Object.fromEntries(['lines', 'regions', 'branches'].map(key => [key, { count: 0, covered: 0 }]));
  const measured = [];
  for (const path of requiredFiles) {
    const found = files.filter(file => file.filename.replaceAll('\\', '/').endsWith(`/${path}`) || file.filename === path);
    if (found.length !== 1) throw new Error(`F05 coverage requires exactly one entry for ${path}`);
    const summary = found[0].summary;
    for (const key of Object.keys(totals)) {
      const metric = summary?.[key];
      if (!metric || !Number.isInteger(metric.count) || !Number.isInteger(metric.covered) || metric.count < 0 || metric.covered < 0 || metric.covered > metric.count || (key !== 'branches' && metric.count === 0)) throw new Error(`Invalid ${key} coverage for ${path}`);
      if (!Number.isFinite(metric.percent) || (metric.count && Math.abs(metric.percent - metric.covered / metric.count * 100) > 0.02)) throw new Error(`Inconsistent ${key} coverage for ${path}`);
      totals[key].count += metric.count; totals[key].covered += metric.covered;
    }
    // An aggregate must not conceal an untested persistence adapter.
    if (path.endsWith('/pg.rs') || path.endsWith('/supabase_storage.rs')) {
      for (const [key, threshold] of [['lines', 90], ['regions', 85]]) {
        if (summary[key].covered / summary[key].count * 100 < threshold) throw new Error(`${path} ${key} below ${threshold}%`);
      }
    }
    measured.push({ file: path, summary });
  }
  for (const [key, threshold] of [['lines', 90], ['regions', 85], ...(requireBranches ? [['branches', 85]] : [])]) {
    if (!totals[key].count || totals[key].covered / totals[key].count * 100 < threshold) throw new Error(`F05 full-scope ${key} below ${threshold}%`);
  }
  return { scope: requiredFiles, files: measured, totals, requireBranches };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = checkCoverage(JSON.parse(readFileSync(process.argv[2], 'utf8')), process.argv.includes('--branch'));
  console.log(JSON.stringify({ status: 'PASS', ...result }, null, 2));
}
