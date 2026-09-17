import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
export function run(root, command, args, env = process.env, capture = false) {
    return execFileSync(command, args, { cwd: root, env, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', maxBuffer: 32 * 1024 * 1024 });
}
export const sha = data => crypto.createHash('sha256').update(data).digest('hex');
export function exact(actual, expected, label) {
    if (JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort()))
        throw new Error(`${label}: inventory mismatch: ${JSON.stringify({ actual, expected })}`);
}
export function inventory(root) {
    const meta = JSON.parse(run(root, 'cargo', ['metadata', '--locked', '--no-deps', '--format-version', '1'], process.env, true));
    const rust = meta.packages.filter(p => meta.workspace_members.includes(p.id));
    const python = JSON.parse(run(root, 'uv', ['run', '--locked', '--project', 'engines', '--all-packages', '--group', 'build', 'python', 'scripts/f01-inventory.py'], process.env, true));
    const js = JSON.parse(run(root, 'pnpm', ['list', '--recursive', '--depth', '-1', '--json'], process.env, true)).filter(p => path.resolve(p.path) !== root).map(p => {
        const relative = path.relative(root, p.path);
        const manifest = JSON.parse(fs.readFileSync(path.join(p.path, 'package.json')));
        if (relative.includes('desktop'))
            throw new Error('Desktop is outside F01');
        if (!manifest.scripts?.build)
            throw new Error(`Missing build script: ${relative}`);
        return { directory: relative, name: p.name, output: `${relative}/${relative.startsWith('apps/') ? 'out' : 'dist'}` };
    });
    const disk = ['apps/website', 'apps/terminal', ...fs.readdirSync(path.join(root, 'packages')).filter(d => fs.existsSync(path.join(root, 'packages', d, 'package.json'))).map(d => `packages/${d}`)];
    exact(js.map(p => p.directory), disk, 'JS workspace');
    const pythonDisk = fs.readdirSync(path.join(root, 'engines')).filter(d => fs.existsSync(path.join(root, 'engines', d, 'pyproject.toml'))).map(d => `engines/${d}`);
    exact(python.python.map(p => p.directory), pythonDisk, 'Python workspace');
    const rustDisk = ['crates', 'services'].flatMap(d => fs.readdirSync(path.join(root, d)).filter(n => fs.existsSync(path.join(root, d, n, 'Cargo.toml'))).map(n => `${d}/${n}`));
    exact(rust.map(p => path.relative(root, path.dirname(p.manifest_path))), rustDisk, 'Rust workspace');
    return { rustBinaries: rust.flatMap(p => p.targets.filter(t => t.kind.includes('bin')).map(t => t.name)).sort(), rustDirectories: rustDisk, js, ...python };
}
export function files(root) {
    if (!fs.existsSync(root))
        throw new Error(`Missing output: ${root}`);
    return fs.readdirSync(root, { withFileTypes: true }).flatMap(e => {
        if (e.isSymbolicLink())
            throw new Error(`Unexpected output symlink: ${e.name}`);
        const p = path.join(root, e.name);
        return e.isDirectory() ? files(p) : [p];
    }).sort();
}
export function digest(paths, root) {
    if (!paths.length)
        throw new Error(`Empty output: ${root}`);
    const entries = paths.map(p => ({ path: path.relative(root, p), sha256: sha(fs.readFileSync(p)), sizeBytes: fs.statSync(p).size }));
    return { sha256: sha(JSON.stringify(entries)), files: entries };
}
export function validateOutputs(root, expected) {
    const rustRoot = path.join(root, 'target/release');
    const binaries = fs.readdirSync(rustRoot, { withFileTypes: true }).filter(e => e.isFile() && (fs.statSync(path.join(rustRoot, e.name)).mode & 0o111)).map(e => e.name);
    exact(binaries, expected.rustBinaries, 'Rust executable outputs');
    const pythonRoot = path.join(root, 'artifacts/python');
    const wheels = files(pythonRoot).filter(p => {
        if (path.basename(p) !== '.gitignore') return true;
        if (fs.readFileSync(p, 'utf8').trim() !== '*') throw new Error('Unexpected Python output metadata');
        return false;
    });
    exact(wheels.map(p => path.basename(p)), expected.python.map(p => `${p.name.replaceAll('-', '_')}-${p.version}-py3-none-any.whl`), 'Python wheel outputs');
    const typescript = expected.js.map(p => ({ directory: p.directory, ...digest(files(path.join(root, p.output)), path.join(root, p.output)) }));
    const result = { rust: digest(expected.rustBinaries.map(n => path.join(rustRoot, n)), rustRoot), python: digest(wheels, pythonRoot), typescript };
    return { ...result, combinedSha256: sha(JSON.stringify(result)) };
}
export function requireThree(runs) { if (!Number.isInteger(runs) || runs < 3)
    throw new Error('Formal reproducibility requires at least 3 runs'); }
export function requireMatching(runs) { requireThree(runs.length); if (!runs.every(r => r.combinedSha256 === runs[0].combinedSha256))
    throw new Error('Build digests differ'); }
export function cleanSource(root) {
    if (run(root, 'git', ['status', '--porcelain', '--untracked-files=all'], process.env, true).trim())
        throw new Error('Formal evidence requires a clean committed source tree');
    return { commit: run(root, 'git', ['rev-parse', 'HEAD'], process.env, true).trim(), tree: run(root, 'git', ['rev-parse', 'HEAD^{tree}'], process.env, true).trim(), dirty: false };
}
