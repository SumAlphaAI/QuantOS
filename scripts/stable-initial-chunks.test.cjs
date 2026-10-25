const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { StableInitialChunksPlugin } = require('./lib/stable-initial-chunks.cjs');
const bundled = require('../apps/terminal/node_modules/next/dist/compiled/webpack/webpack');
bundled.init();
const webpack = bundled.webpack;

function attach(module) {
  new StableInitialChunksPlugin().apply({ hooks: { compilation: { tap: (_, cb) => cb({ hooks: { runtimeModule: { tap: (_, hook) => hook(module) } } }) } } });
}
test('generation restores the exact original chunk method even when it throws', () => {
  const original = () => new Set([{ ids: [3] }, { ids: [1] }]);
  const chunk = { getAllInitialChunks: original };
  const descriptor = Object.getOwnPropertyDescriptor(chunk, 'getAllInitialChunks');
  const module = { name: 'jsonp chunk loading', chunk, generate() {
    assert.deepEqual([...this.chunk.getAllInitialChunks()].map(c => c.ids[0]), [1, 3]);
    throw new Error('generation refused');
  } };
  attach(module);assert.throws(() => module.generate(), /generation refused/);
  assert.deepEqual(Object.getOwnPropertyDescriptor(chunk, 'getAllInitialChunks'), descriptor);
});
test('prototype method is not shadowed after generation; other runtime modules stay unchanged', () => {
  const prototype = { getAllInitialChunks: () => new Set([{ ids: [2] }, { ids: [1] }]) };
  const chunk = Object.create(prototype), generate = function () { return [...this.chunk.getAllInitialChunks()].map(c => c.ids[0]); };
  const module = { name: 'jsonp chunk loading', chunk, generate };attach(module);
  assert.deepEqual(module.generate(), [1, 2]);assert.equal(Object.hasOwn(chunk, 'getAllInitialChunks'), false);
  assert.deepEqual([...chunk.getAllInitialChunks()].map(c => c.ids[0]), [2, 1]);
  const other = { name: 'different runtime', generate };attach(other);assert.equal(other.generate, generate);
});

async function compile(root, order, stable) {
  const output = path.join(root, `${stable ? 'stable' : 'native'}-${order.join('-')}`);
  const compiler = webpack({ mode: 'production', context: root, entry: './entry.js',
    output: { path: output, filename: '[name].js', uniqueName: 'stable-fixture' },
    optimization: { runtimeChunk: 'single', minimize: false },
    plugins: [{ apply(compiler) {
      compiler.hooks.thisCompilation.tap('PerturbCssOnlyInitialChunks', compilation => {
        compilation.hooks.runtimeModule.tap('PerturbCssOnlyInitialChunks', module => {
          if (module.name !== 'jsonp chunk loading') return;
          const initial = module.chunk.getAllInitialChunks.bind(module.chunk);
          const extras = order.map(id => { const chunk = compilation.addChunk(`css-${id}`);chunk.id = id;chunk.ids = [id];return chunk; });
          module.chunk.getAllInitialChunks = () => new Set([...initial(), ...extras]);
        });
      });
    } }, ...(stable ? [new StableInitialChunksPlugin()] : [])],
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => {
    compiler.close(closeError => {
      if (error || closeError) return reject(error || closeError);
      if (stats.hasErrors()) return reject(Error(JSON.stringify(stats.toJson({ all: false, errors: true }).errors)));
      resolve();
    });
  }));
  return fs.readFileSync(path.join(output, 'runtime.js'), 'utf8');
}
test('real bundled Webpack: perturbed CSS-only initial chunks drift before the plugin and produce identical complete runtime bytes after it', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quantos-runtime-order-'));
  try {
    fs.writeFileSync(path.join(root, 'entry.js'), 'console.log("stable fixture");\n');
    const a = [9301, 9201, 9101], b = [9101, 9301, 9201];
    assert.notEqual(await compile(root, a, false), await compile(root, b, false));
    const first = await compile(root, a, true), second = await compile(root, b, true);
    assert.equal(first, second);
    for (const id of a) assert(first.includes(`${id}: 0`), 'all initial IDs retained');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
