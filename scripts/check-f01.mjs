import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inventory, exact } from './f01-lib.mjs';
import { checkToolchains } from './check-toolchains.mjs';
export function checkReadmes(root, data) {
    const directories = ['proto', 'crates', 'services', 'engines', 'apps', 'packages', 'supabase', ...data.rustDirectories, ...data.python.map(p => p.directory), ...data.js.map(p => p.directory)];
    for (const d of directories)
        if (!fs.existsSync(path.join(root, d, 'README.md')) || fs.readFileSync(path.join(root, d, 'README.md'), 'utf8').trim().length < 30)
            throw new Error(`Missing module boundary README: ${d}`);
    const services = fs.readFileSync(path.join(root, 'services/README.md'), 'utf8');
    for (const n of data.rustBinaries)
        if (!services.includes('`' + n + '`'))
            throw new Error(`Missing service index: ${n}`);
    return directories.length;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const toolchains = checkToolchains(root);
    const data = inventory(root);
    const constraints = fs.readFileSync(path.join(root, 'engines/build-constraints.txt'), 'utf8').trim().split('\n').filter(l => !l.startsWith('#'));
    exact(constraints, Object.entries(data.buildClosure).map(([n, v]) => `${n}==${v}`), 'Python build closure');
    const lint = JSON.parse(fs.readFileSync(path.join(root, 'apps/terminal/package.json'))).scripts.lint;
    if (!/eslint app src tests --ext \.ts,\.tsx/.test(lint))
        throw new Error('Terminal lint excludes pages');
    console.log(JSON.stringify({ status: 'PASS', toolchains, moduleReadmes: checkReadmes(root, data), inventory: data }, null, 2));
}
