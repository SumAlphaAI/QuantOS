# da43d0e1 CI evidence

Hosted results apply to da43d0e1d6ede9abf0e099ce7ba173eee4fbfb3d. Source-binding.json plus the enclosing commit bind current local repair inputs; precommit sourceCommit values remain the base HEAD, not new hosted acceptance.

- workflow-runs.json: nine push runs, seven success / two failure. Original F01 jobs/report show clean-room and reproducibility success; clean-room 1189.818 seconds within the original 1800 limit. Browser jobs all successful.
- 41159268600* and 41159268617*: exact original failing jobs/logs. original-a2-* preserves the Frontend artifact, including four correctly rejected mutants and a fifth rejected=false due to missing compile-time JSON; the last four had not run.
- current-a2-* retains actual semantics (8 policy / 17 provider / 29 client) and all nine business-assertion mutation logs, output hashes, original source/lock identities and two fixture hashes. FAILED here is the intentional mutant business result; the full runner/gate succeeded.
- contract-gate.log.gz and contract-commands.json: actual whole 27-recipe BFF contract step, exit0, including post-A2 recipes. NOT_ASSESSED / admitted=false remains non-admission.
- scope-review.json: unchanged nine mutation definitions/commands/timeout/refusal predicate, original five mutation bodies/test names, production source, locks, Makefile and credential scan controls. Historical JSON bytes unchanged.
- Initial ESLint global errors retained; explicit process/console imports fix them. Final A1 metadata/static check still reports formalAccepted=false.

No new hosted CI, full F01, actual Supabase/exchange, F05/F07 campaign or target/release acceptance. No push/deploy. Gzip integrity and SHA256SUMS cover all members except SHA256SUMS itself; postcommit history secret scan is reported separately at delivery.
