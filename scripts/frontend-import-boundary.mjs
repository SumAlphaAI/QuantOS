// Production applications consume public BFF contracts. Legacy adapters remain test-only.
export const legacyNames = ['InMemoryTerminalBackend','InMemoryStrategyBackend','InMemoryExecutionBackend','InMemoryOpsBackend','TerminalBackend','StrategyBackend','ExecutionBackend','OpsBackend'];
const api = source => source === '@sumalpha/api-client' || /(?:^|\/)api-client(?:\/|$)/.test(source);
const privateModule = source => /(?:^|\/)(?:crates|engines|venues|database|supabase|tests|__tests__|fixtures)(?:\/|$)/.test(source) || /^@(?:sumalpha|quantos)\/(?:backend|engine|venue|database|storage)(?:\/|$)/.test(source) || (api(source) && !['@sumalpha/api-client','@sumalpha/api-client/bff-gen'].includes(source));
export const frontendBoundary = {
  meta: { type:'problem', schema:[], messages:{ boundary:'Production frontend must use public generated BFF contracts; legacy adapters, private modules, test fixtures and unrestricted module loading are forbidden.' } },
  create(context) {
    const report = node => context.report({node,messageId:'boundary'});
    function declaration(node) {
      const source = node.source?.value;
      if(typeof source !== 'string') return;
      if(privateModule(source) || (api(source) && (!node.specifiers?.length || node.type==='ExportAllDeclaration' || node.specifiers.some(s => s.type==='ImportNamespaceSpecifier' || s.type==='ImportDefaultSpecifier' || legacyNames.includes(s.imported?.name ?? s.imported?.value ?? s.local?.name))))) report(node);
    }
    return {
      ImportDeclaration:declaration, ExportNamedDeclaration:declaration, ExportAllDeclaration:declaration,
      ImportExpression(node) { if(typeof node.source.value!=='string' || api(node.source.value) || privateModule(node.source.value)) report(node); },
      CallExpression(node) { if(['require','eval'].includes(node.callee.name) || (node.callee.type==='MemberExpression' && node.callee.object.name==='module' && node.callee.property.name==='require')) report(node); },
    };
  },
};
