import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
const root = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'quantos-lock-'));
try {
    const workspace = parse(fs.readFileSync('pnpm-workspace.yaml', 'utf8'));
    if (JSON.stringify(workspace.packages) !== JSON.stringify(['apps/website', 'apps/terminal', 'packages/*']))
        throw new Error('F01 workspace scope drift');
    const buf = parse(fs.readFileSync('buf.lock', 'utf8'));
    if (!['v1', 'v2'].includes(buf.version) || !Array.isArray(buf.deps) || !buf.deps.length || buf.deps.some(d => !d.commit || !d.digest))
        throw new Error('Invalid Buf lock');
    const roots = ['.', 'apps/website', 'apps/terminal', ...fs.readdirSync('packages').filter(p => fs.existsSync(`packages/${p}/package.json`)).map(p => `packages/${p}`)];
    const lock = parse(fs.readFileSync('pnpm-lock.yaml', 'utf8'));
    if (JSON.stringify(Object.keys(lock.importers).sort()) !== JSON.stringify(roots.sort()))
        throw new Error('pnpm importer mismatch');
    for (const file of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', ...roots.map(p => path.join(p, 'package.json'))]) {
        fs.mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true });
        fs.copyFileSync(path.join(root, file), path.join(scratch, file));
    }
    execFileSync('pnpm', ['install', '--lockfile-only', '--frozen-lockfile', '--ignore-scripts'], { cwd: scratch, stdio: 'inherit' });
}
finally {
    fs.rmSync(scratch, { recursive: true, force: true });
}
