const pluginName = 'StableInitialChunksPlugin';

// Webpack 5.98's JSONP runtime emits getInitialChunkIds in graph traversal order.
// Parallel entry discovery can reorder the same zero-valued installedChunks map.
// Sort the input Set during generation, without changing the graph or filtering
// emitted bytes from the reproducibility check.
class StableInitialChunksPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap(pluginName, compilation => {
      const wrapped = new WeakSet();
      compilation.hooks.runtimeModule.tap(pluginName, module => {
        if (module.name !== 'jsonp chunk loading' || wrapped.has(module)) return;
        wrapped.add(module);
        const generate = module.generate;
        module.generate = function (...args) {
          const chunk = this.chunk;
          const descriptor = Object.getOwnPropertyDescriptor(chunk, 'getAllInitialChunks');
          const original = chunk.getAllInitialChunks;
          chunk.getAllInitialChunks = function () {
            const chunks = [...original.call(this)];
            const key = value => {
              if (!Array.isArray(value.ids) || value.ids.some(id => !['string', 'number'].includes(typeof id))) {
                throw new Error('Stable initial chunk order requires assigned chunk IDs');
              }
              return JSON.stringify(value.ids);
            };
            return new Set(chunks.sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
          };
          try { return generate.apply(this, args); }
          finally {
            if (descriptor) Object.defineProperty(chunk, 'getAllInitialChunks', descriptor);
            else delete chunk.getAllInitialChunks;
          }
        };
      });
    });
  }
}
module.exports = { StableInitialChunksPlugin };
