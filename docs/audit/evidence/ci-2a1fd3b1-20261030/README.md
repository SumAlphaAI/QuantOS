# 2a1fd3b1 CI evidence

Hosted inputs/results are bound to `2a1fd3b14719b173212904bcf8fab4d7432551ce`. Local repair inputs are bound by source-binding.json and the enclosing commit, not the precommit HEAD printed by GITHUB_SHA.

- workflow-runs.json: 9 push results, 6 success / 2 failure / 1 cancelled.
- 41045035104*: Compatibility jobs/log and Firefox website artifact; firefox-confirmation.json extracts all 19 cases and mouse result, all retry=0.
- 41045035130* / 41045035173*: Frontend coverage and A1 original failures.
- 41045035314*: cancelled F01; remote-failures.json preserves all 10 known FAILED names before timeout.
- commands.json: current scoped commands/results; fixture-binding.json records emitted executables/profile and current embedded BFF policy. False for execution-gateway policy embedding is not a test failure: only BFF embeds that policy.
- scope-review.json/mjs: preserved wire schemas, parameters, security and historical/provider/target baseline fields. Run from repo root at the enclosing commit; script reads exact base from git.
- l04-host-only-interrupted.log.gz: interrupted intermediate attempt, NOT_PASS. Initial lint and PRE-04 source-digest failures are preserved alongside final results.

No new hosted CI, full clean-room, real database, F05/F07 campaign, exchange or release/performance acceptance. Empty successful lint/tsc/fmt logs are preserved; checksums cover every archive member except SHA256SUMS itself.
