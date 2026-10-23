# Unfrozen exploratory observations

These are summaries of tool results, not raw logs or frozen candidate evidence.

- Initial global pnpm wrapper emitted an ignored pnpm configuration warning and did not finish in the observation window. Switched to repository pinned pnpm 10.20.0 via webEnvironment; wrapper finally exited 1 with GET registry.npmjs.org/pnpm fetch failed. No dependencies were installed; wrapper run not counted as PASS.
- Initial pinned typecheck exited 2: runtime.ts result possibly undefined. Second typecheck exited 2 also for a test report status widened to string. Both corrected before frozen run.
- Initial frontend run: ui302 30 + ui301 34 + strategy-recovery 4 = 68 passed; this was an unfrozen worktree, not candidate acceptance.
- Rust format first check exited 1; raw diagnostic retained in rust-format-initial.log. Formatting applied only to task paths.

- First Chromium run: 9 passed, 2 failed. Old UI301 message expectation and unscoped alert locator were corrected; original raw log/report/screenshots preserved. This was an unfrozen worktree.
