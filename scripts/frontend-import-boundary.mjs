// Production applications consume public BFF contracts. Legacy adapters remain test-only.
export const legacyNames = ['InMemoryTerminalBackend','InMemoryStrategyBackend','InMemoryExecutionBackend','InMemoryOpsBackend','TerminalBackend','StrategyBackend','ExecutionBackend','OpsBackend','createTerminalClient'];
const api = source => source === '@sumalpha/api-client' || /(?:^|\/)api-client(?:\/|$)/.test(source);
const privateModule = source => /^(?:@supabase\/|@prisma\/|@binance\/|pg$|postgres$|knex$|ccxt$|binance-api-node$|quantos_engine_sdk$)/.test(source) || /(?:^|\/)(?:crates|engines|venues|database|db|scripts|supabase|tests|__tests__|fixtures)(?:\/|$)/.test(source) || /^@(?:sumalpha|quantos)\/(?:backend|engine|venue|database|storage)(?:\/|$)/.test(source) || (api(source) && !['@sumalpha/api-client','@sumalpha/api-client/bff-gen'].includes(source));
export const frontendBoundary = {
  meta: { type:'problem', schema:[], messages:{ boundary:'Production frontend must use public generated BFF contracts; legacy adapters, private modules, test fixtures and unrestricted module loading are forbidden.' } },
  create(context) {
    const report = node => context.report({node,messageId:'boundary'});
    function forbiddenSpecifier(s,node) {
      const name=s.imported?.name ?? s.imported?.value ?? s.local?.name;
      const typeOnly=[s.importKind,node.importKind,s.exportKind,node.exportKind].includes('type');
      return s.type==='ImportNamespaceSpecifier' || s.type==='ImportDefaultSpecifier' || legacyNames.includes(name) || (name==='TerminalClient' && !typeOnly);
    }
    function declaration(node) {
      const source = node.source?.value;
      if(typeof source !== 'string') return;
      if(privateModule(source) || (api(source) && (!node.specifiers?.length || node.type==='ExportAllDeclaration' || node.specifiers.some(s => forbiddenSpecifier(s,node))))) report(node);
    }
    return {
      ImportDeclaration:declaration, ExportNamedDeclaration:declaration, ExportAllDeclaration:declaration,
      ImportExpression(node) { if(typeof node.source.value!=='string' || api(node.source.value) || privateModule(node.source.value)) report(node); },
      CallExpression(node) { if(['require','eval'].includes(node.callee.name) || (node.callee.type==='MemberExpression' && node.callee.object.name==='module' && node.callee.property.name==='require')) report(node); },
    };
  },
};
