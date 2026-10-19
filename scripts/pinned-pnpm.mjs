import { existsSync, readFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const packageManager = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).packageManager;
export const pinnedPnpmVersion = packageManager.match(/^pnpm@([^+]+)/)[1];

// CI prepares pnpm through Corepack on PATH; macOS may also have a pinned cache.
// Validate the actual executable instead of requiring one operator's home layout.
export function pinnedPnpmDirectory(env) {
  const candidates = [
    ...(env.HOME ? [join(env.HOME, 'Library/pnpm/.tools/pnpm', pinnedPnpmVersion, 'bin/pnpm')] : []),
    ...(env.PATH ?? '').split(delimiter).filter(Boolean).map(path => join(path, 'pnpm')),
  ];
  for (const candidate of new Set(candidates)) {
    if (!existsSync(candidate)) continue;
    const result = spawnSync(candidate, ['--version'], {
      env: { ...env, COREPACK_ENABLE_NETWORK: '0', npm_config_offline: 'true' },
      encoding: 'utf8', timeout: 10000,
    });
    if (result.status === 0 && result.stdout.trim() === pinnedPnpmVersion) return dirname(candidate);
  }
  throw new Error(`pinned pnpm ${pinnedPnpmVersion} required on PATH or in the local cache`);
}
