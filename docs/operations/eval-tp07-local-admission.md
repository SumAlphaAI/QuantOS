# EVALUATION:TP07 local admission

EVAL-TP07_LOCAL expands F03/F06/F08 to 7 prerequisite nodes and 25 fresh local check groups, then 3 evaluation groups: 8 nodes/28 groups. Every group reruns at one frozen candidate; no old S04/F03/F06/F08 READY is consumed. Shared-input changes withdraw SERVICE:S04 independent READY; historical evidence remains unchanged.

Preflight: QUANTOS_SKIP_ENV=1 make eval-tp07-check. Freeze/commit all inputs, then QUANTOS_SKIP_ENV=1 make eval-tp07-assess-local (or node scripts/record-eval-tp07-local.mjs with a fresh attempt-NN path). The recorder strips credentials and target opt-ins, performs three independent builds and make lint/test plus all prerequisite checks, backs up/restores canonical generated artifacts, then atomically writes only this checkpoint's local admission. New attempts never reuse earlier passing groups.

python3 scripts/tp07-evaluation.py verifies immutable blob hashes, exact license declarations, complete lock-level SPDX2.3 inventory, bound advisory snapshot and unknowns, 7 capability records and runtime exclusions. It never executes upstream code or refreshes OSV during assessment. Current public snapshot matched 56 advisory IDs over 1004 registry package/version pairs; 47 non-registry entries and transitive license conclusions remain unassessed. Runtime remains DENIED regardless of snapshot results. --runtime refuses even after a local Gate passes.

make eval-tp07-local-check verifies the live input hashes against the frozen receipt; make eval-tp07-release-check must refuse missing Beta target/confirmation receipts. Only EVALUATION:TP07 may become DEVELOPMENT READY. CORE:TP07/X3, actual Nautilus process/kernel/transport, legal/distribution approval, deployed/runtime SBOM, current severity/reachability/remediation, target Supabase and performance/same-SHA CI remain separate NOT_RUN obligations. This does not import or install Nautilus or create a local database.

Formal ProjectUser confirmation remains PENDING; draft six review dimensions, never self-approve. Reference bytes are from local immutable Git objects; newly verified remote signature/provenance is not claimed.
