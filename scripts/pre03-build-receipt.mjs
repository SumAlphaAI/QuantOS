import { loadEffectiveConfig } from './pre03-next-config.mjs';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const excluded = new Set(['node_modules', '.next', 'out', 'dist', 'coverage', 'storybook-static', '.git', '__pycache__']);
export function sourceDigest(root, environment = process.env) {
  const hash = createHash('sha256');
  function visit(relative) {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      if (excluded.has(entry.name) || entry.name.endsWith('.tsbuildinfo') || entry.name.endsWith('.pyc') || entry.name === '.DS_Store' || entry.name.startsWith('.env')) continue;
      const path = join(relative, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) hash.update(path).update('\0').update(readFileSync(join(root, path))).update('\0');
    }
  }
  for (const path of ['apps/terminal', 'apps/website', 'packages', 'scripts']) visit(path);
  for (const path of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.nvmrc', 'tsconfig.base.json', 'eslint.config.mjs', 'docs/adr/20260814-pre03-runtime-stack.md']) hash.update(path).update(readFileSync(join(root,path)));
  const profile = Object.fromEntries(Object.entries(environment).filter(([name]) => name.startsWith('NEXT_PUBLIC_')).sort(([a],[b]) => a.localeCompare(b)));
  hash.update(JSON.stringify(profile));
  return hash.digest('hex');
}
export function writeBuildReceipt(root, app) {
  if (!['terminal', 'website'].includes(app)) throw new Error('Unknown Web application');
  const build = JSON.parse(readFileSync(join(root, `apps/${app}/.next/required-server-files.json`), 'utf8'));
  const effective = loadEffectiveConfig(root, app);
  if (effective.output !== build.config.output) throw new Error(`${app}: build/config output mismatch`);
  const receipt = { schema:'quantos-pre03-build/v1', app, sourceDigest:sourceDigest(root, effective.publicEnv), output:build.config.output, buildId:readFileSync(join(root, `apps/${app}/.next/BUILD_ID`),'utf8').trim() };
  writeFileSync(join(root, `apps/${app}/out/pre03-build.json`), JSON.stringify(receipt,null,2)+'\n');
  return receipt;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeBuildReceipt(resolve(dirname(fileURLToPath(import.meta.url)), '..'), process.argv[2]);
}
