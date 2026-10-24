# Preflight diagnostics (unfrozen worktree)

2026-10-24 first scoped command:
`pnpm exec vitest run apps/terminal/tests/ui-p21.test.tsx apps/terminal/tests/ui403.test.ts --reporter=dot`
exit 1; 48 passed, 2 failed. Both new SSR tests failed with `ReferenceError: React is not defined` at MetricCards/EquityChart in p21-components.tsx. Browser/Next automatic JSX transform differs from this Vitest classic JSX path. Added explicit React import. First Terminal typecheck passed. This record is a tool-output diagnostic excerpt, not a replacement raw full log or frozen acceptance.
