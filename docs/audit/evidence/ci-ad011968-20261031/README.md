# ad011968 CI evidence

Hosted runs apply to ad011968281d1b71c8ec876548665ada493bfb0d. Current local source is bound by source-binding.json and the enclosing commit. GITHUB_SHA/sourceCommit in precommit logs is the base HEAD, not proof of hosted validation for the new commit.

- workflow-runs.json: nine push runs (six success, three failure), plus three scheduled successes.
- 41057928531*: original F01 jobs/log; original-f01-clean-room.json and remote-failures.json preserve actual failure, Terminal counts and 77 successful L04 cases. The failed make command took 2025.489 seconds; a new complete clean-room timing result remains NOT_RUN.
- 41057928564* and 41057928518*: exact A2 structural/proof failures before current semantics could start.
- 41057928615-jobs.json: all three browser jobs successful for the base SHA.
- semantics.json/log archives: actual current A2 execution with output hashes, not synthetic acceptance.
- test-web.log.gz: actual same entry point as revised Makefile, all pnpm package cwd tests, including Terminal 1893 and total 2098 passes / 3 existing domain-ui skips.
- fixture-root.log.gz: root cwd counterpart for the affected 107 UI model tests.
- commands.json: scoped commands, final results and interrupted/environment-only attempts. Empty lint/typecheck logs are successful.
- fixture-binding.json: actual Cargo executable, profile debug/overflow checks and current embedded input policy. scope-review.json: unchanged production/API/Gate and historical stage boundary.

No new hosted CI, complete clean-room, three builds, database, F05/F07 campaign, exchange, performance or release acceptance. Temporary interrupted lint probe was removed. Gzip integrity and SHA256SUMS cover all members except SHA256SUMS itself. Postcommit full-history credential scan is reported separately in delivery.
