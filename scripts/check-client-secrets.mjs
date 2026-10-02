#!/usr/bin/env node
import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { secretFingerprints, serverSecretVariants } from '../packages/config/src/env.ts';

export function scanClientArtifacts(roots, environment = process.env) {
  const failures = []; let files = 0;
  const serverValues = serverSecretVariants(environment);
  function visit(path) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error('Client artifact symlinks are forbidden');
    if (stat.isDirectory()) for (const name of readdirSync(path).sort()) visit(join(path, name));
    else if (stat.isFile() && /\.(?:js|mjs|html|map|css|json|txt|svg)$/i.test(path)) {
      files++; const content = readFileSync(path, 'utf8');
      const labels = secretFingerprints(content);
      if (serverValues.some(value => content.includes(value))) labels.push('injected server credential');
      if (labels.length) failures.push({ path, labels: [...new Set(labels)] });
    }
  }
  if (!roots.length) throw new Error('At least one client artifact directory is required');
  for (const root of roots) {
    const path = resolve(root);
    if (!lstatSync(path).isDirectory()) throw new Error('Expected client artifact directory');
    const before = files; visit(path);
    if (files === before) throw new Error('Client artifact directory has no inspectable files');
  }
  return { status: failures.length ? 'FAIL' : 'PASS', files, failures };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = scanClientArtifacts(process.argv.slice(2));
    for (const failure of result.failures) console.error(`FAIL ${failure.path}: ${failure.labels.join(', ')}`);
    if (result.failures.length) process.exitCode = 1;
    else console.log(`Client secret check PASS (${result.files} files)`);
  } catch {
    console.error('Client secret check FAIL: missing, empty or invalid artifact directory'); process.exitCode = 1;
  }
}
