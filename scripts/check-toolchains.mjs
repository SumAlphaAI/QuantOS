import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export function checkToolchains(root) {
    const pinned = {
        node: fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim(),
        uv: fs.readFileSync(path.join(root, '.uv-version'), 'utf8').trim(),
        pnpm: JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).packageManager.split('@').at(-1),
        rustc: /channel\s*=\s*"([^"]+)"/.exec(fs.readFileSync(path.join(root, 'rust-toolchain.toml'), 'utf8'))[1],
    };
    const actual = {};
    for (const [tool, expected] of Object.entries(pinned)) {
        const output = execFileSync(tool, ['--version'], { cwd: root, encoding: 'utf8' }).trim();
        const version = /\d+\.\d+\.\d+/.exec(output)?.[0];
        if (version !== expected)
            throw new Error(`${tool}: expected ${expected}, got ${output}`);
        actual[tool] = version;
    }
    return actual;
}
if (process.argv[1] === fileURLToPath(import.meta.url))
    console.log(JSON.stringify(checkToolchains(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')), null, 2));
