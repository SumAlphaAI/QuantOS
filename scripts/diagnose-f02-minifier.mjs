import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'apps/terminal/package.json'));
const { minify } = require('next/dist/build/swc');
const input = fs.readFileSync(path.join(root, 'tests/fixtures/f02/ui-before-minify.js'), 'utf8');
const output = path.join(root, 'artifacts/minifier-diagnostic');
fs.mkdirSync(output, { recursive: true });
const hashes = new Map();
const options = { compress: { inline: 2, global_defs: { 'process.env.__NEXT_PRIVATE_MINIMIZE_MACRO_FALSE': false }, keep_classnames: false, keep_fnames: false }, mangle: { reserved: ['AbortSignal'], disableCharFreq: false }, module: 'unknown', output: { comments: false } };
for (let batch = 0; batch < 256; batch++) {
  const results = await Promise.all(Array.from({ length: 16 }, () => minify(input, options)));
  for (const { code } of results) {
    const sha = createHash('sha256').update(code).digest('hex');
    hashes.set(sha, (hashes.get(sha) || 0) + 1);
    fs.writeFileSync(path.join(output, sha + '.js'), code);
  }
  if (hashes.size > 1) break;
}
const result = { kind: 'DIAGNOSTIC_NOT_ACCEPTANCE', platform: process.platform, inputSha256: createHash('sha256').update(input).digest('hex'), hashes: Object.fromEntries(hashes) };
fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
