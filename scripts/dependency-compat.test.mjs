import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { AbortController, AbortSignal, fetch, URL } = globalThis;

const require = createRequire(import.meta.url);
const consumer = (name, from = require) => createRequire(from.resolve(name));
const eslint = consumer('eslint');
const redocly = consumer('@redocly/openapi-core', consumer('openapi-typescript'));
const readPackage = consumer('read-package-json', consumer('read-installed-packages', consumer('license-checker-rseidelsohn')));

for (const [name, from] of [['eslint', eslint], ['redocly', redocly], ['glob', consumer('glob', readPackage)]]) {
  test(`${name} receives the fixed minimatch with the legacy callable API`, () => {
    assert.equal(from('minimatch/package.json').version, '11.0.1');
    const match = from('minimatch');
    assert.equal(typeof match, 'function');
    assert.equal(match, match.minimatch);
    assert.equal(match, match.default);
    assert.equal(match('src/fixture.ts', '**/*.ts'), true);
    assert.equal(match('src/fixture.js', '**/*.ts'), false);
    assert.equal(new match.Minimatch('src/{first,second}.ts').match('src/second.ts'), true);
    assert.deepEqual(match.match(['src/a.ts', 'src/a.js'], '**/*.ts'), ['src/a.ts']);
  });
}

test('ESM default and named minimatch exports preserve upstream matcher identity', async () => {
  const directory = dirname(eslint.resolve('minimatch/package.json'));
  const module = await import(pathToFileURL(join(directory, 'dist/esm/index.js')).href);
  assert.equal(module.default, module.minimatch);
  assert.equal(module.default('src/a.ts', '**/*.ts'), true);
  assert.equal(new module.Minimatch('**/*.js').match('src/a.ts'), false);
});

test('license traversal uses fixed glob and honors an already aborted budget', async () => {
  assert.equal(readPackage('glob/package.json').version, '14.0.2');
  const glob = readPackage('glob');
  const directory = mkdtempSync(join(tmpdir(), 'quantos-glob-compat-'));
  try {
    writeFileSync(join(directory, 'fixture.ts'), 'fixture');
    writeFileSync(join(directory, 'fixture.js'), 'fixture');
    assert.deepEqual(glob.globSync('*.ts', { cwd: directory }), ['fixture.ts']);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(glob.glob('**/*', { cwd: directory, signal: controller.signal }), { name: 'AbortError' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('fixed Vite refuses denied files for raw/import query variants while serving an allowed file', async () => {
  const ui = createRequire(new URL('../packages/ui/package.json', import.meta.url));
  const directory = dirname(ui.resolve('vite/package.json'));
  assert.equal(JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).version, '6.4.5');
  const { createServer } = await import(pathToFileURL(join(directory, 'dist/node/index.js')).href);
  const root = mkdtempSync(join(tmpdir(), 'quantos-vite-deny-'));
  const denied = join(root, '.env');
  const marker = 'fixture-private-file-contents';
  writeFileSync(denied, marker);
  writeFileSync(join(root, 'allowed.txt'), 'allowed-fixture');
  const server = await createServer({ root, configFile: false, envDir: join(root, 'absent'), logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root], deny: ['**/.env'] } } });
  try {
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    for (const query of ['?raw', '?import&raw', '?import&url&inline']) {
      const response = await fetch(`${origin}/@fs/${denied}${query}`, { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 403, query);
      assert.equal((await response.text()).includes(marker), false, query);
    }
    const allowed = await fetch(`${origin}/allowed.txt?raw`, { signal: AbortSignal.timeout(5000) });
    assert.equal(allowed.status, 200);
    assert.match(await allowed.text(), /allowed-fixture/);
  } finally { await server.close(); rmSync(root, { recursive: true, force: true }); }
});
