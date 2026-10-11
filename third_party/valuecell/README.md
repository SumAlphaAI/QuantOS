# TP10 read-only evaluation

This directory contains QuantOS-owned metadata, IA observations and validation only. No upstream source or assets are retained. Fixed historical version and public-file digests are in `baseline.lock.json` and `provenance.json`; no current-main claim is made.

- `patterns.json`: 12 uniquely identified, graded references to actual Terminal spec anchors, five design follow-ups and seven forbidden couplings.
- `ux-gap-report.md`: human-readable report and upstream observation limitations.
- `check-development.mjs`: content-bound engineering recorder and strict DEVELOPMENT admission verification.

```sh
node scripts/tp10-evaluation.mjs --workspace
node scripts/tp10-evaluation.mjs --verify-upstream
node --test scripts/tp10-evaluation.test.mjs
engines/.venv/bin/python -m pytest engines/tests/test_tp10_valuecell_evaluation.py -vv
node third_party/valuecell/check-development.mjs --record
# After clean-source unified F0/TP10 assessment succeeds:
node third_party/valuecell/check-development.mjs --admit
node third_party/valuecell/check-development.mjs --ready
```

The optional online command reads exactly four pinned public documentation/license/descriptor files into memory and checks their digests; it never writes upstream bytes, installs dependencies or launches ValueCell. Offline checks validate recorded observations and mapping integrity; they cannot substitute for an online provenance refresh. Runtime, production inventory, package locks and upstream source/asset copying are denied. Formal acceptance, implemented UI, external widget/API/data rights and current CVE clearance remain separate.
