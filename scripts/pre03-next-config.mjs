import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const worker = fileURLToPath(import.meta.url);
const marker = 'PRE03_EFFECTIVE_CONFIG=';

// Next's environment loader caches and mutates process.env. Isolate each app so
// its .env files and the caller's injected environment use Next's own precedence.
export function loadEffectiveConfig(root, app) {
  const output = execFileSync(process.execPath, [worker, resolve(root), app], {
    encoding: 'utf8', timeout: 30000,
  });
  const result = output.split('\n').findLast((line) => line.startsWith(marker));
  if (!result) throw new Error(`${app}: Next config worker returned no result`);
  return JSON.parse(result.slice(marker.length));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [root, app] = process.argv.slice(2);
  if (!root || !['terminal', 'website'].includes(app)) throw new Error('Expected root and Web app');
  const require = createRequire(join(root, `apps/${app}/package.json`));
  // Config inspection must never trigger Next's implicit dependency installation.
  require.resolve('typescript', { paths: [join(root, `apps/${app}`)] });
  const config = await require('next/dist/server/config.js').default(
    require('next/constants').PHASE_PRODUCTION_BUILD,
    join(root, `apps/${app}`), { silent: true },
  );
  const publicEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('NEXT_PUBLIC_')));
  process.stdout.write(`${marker}${JSON.stringify({ output: config.output, publicEnv })}\n`);
}
