# TP11 OpenStock read-only evaluation

Fixed public baseline and owned offline evaluation; no upstream code/assets or runtime dependencies are stored in this directory. `reference_only`, runtime and real provider data DENIED.

- `baseline.lock.json`, `provenance.json`: fixed commit, actual public-byte digests, documented/unexecuted capabilities and official data-rights observations.
- `provider-comparison.md`: provider, display, schema/lineage/quality gaps and use-rights decisions.
- `fixtures/`: two **QuantOS-owned synthetic** mappings and a TradingView rejection; no live quotes/news/widget bytes.
- `experiments.py`: owned deterministic protobuf contract experiment; test/research only, no provider I/O.
- `check-development.mjs`: records execution and supporting bytes; unified dependency admission required for READY.
- `sbom.spdx.json`: observed-file metadata, not installed/resolved upstream SBOM.
- `cve-audit*.json/md`: preserved historical findings, current scan NOT_ASSESSED.

```sh
node scripts/tp11-evaluation.mjs --verify-upstream
engines/.venv/bin/python third_party/openstock/experiments.py --output artifacts/tp11-development
node scripts/tp11-evaluation.mjs artifacts/tp11-development
cargo test --locked --offline -p quantos-storage --test tp11_reference_gate -- --nocapture
node third_party/openstock/check-development.mjs --record
```

Public verification reads six pinned license/document/descriptor files and two official terms pages in memory, retaining only own observations and hashes. It never clones, installs or executes upstream, queries markets or requests API keys. Current TP05 does not accept Finnhub/quote/news provider records; a future extension and written rights decision remain separate. Local synthetic/F05 tests are not database acceptance; the F0/TP05 dependency closure records development Supabase execution separately.

Only the two exact fixture digests registered in the owned experiment are accepted. Self-asserted synthetic origin/license plus a recomputed hash cannot admit arbitrary data; modifying the registry is a functional source change that invalidates current receipts. This registry is offline test scope, not deployed data-use authority.
