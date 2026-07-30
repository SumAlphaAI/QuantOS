# Third-Party Notices

This repository tracks third-party dependency obligations here.

## Process

1. Generate dependency inventories in CI.
2. Review new licenses before merging.
3. Record any attribution, notice, or distribution obligations in this file.
4. Link exceptions or legal decisions from `docs/adr/` once those ADRs exist.

## Current Status

- F02 baseline created the notice registry.
- Dependency-specific notice entries will be appended as packages are introduced beyond the F01 starter toolchain.

## TP01: Vibe-Trading (`HKUDS/Vibe-Trading`)

- Intake scope: research workflow, MCP, streaming, and UX reference only. No trading connector, session store, or memory store behavior is admitted into QuantOS core contracts.
- Locked upstream tag: `v0.1.12`
- Locked upstream commit: `43331c3221be37c5cc1ed8dddc4c7988bcddc5cd`
- License conclusion: `MIT`
- License file SHA256: `b155549b8bc4e43a9b96b2288dbf4eb1bc0c697f14b3f5ec6b36bf64d5a18679`
- Notice file SHA256: `0f49802f7a666550b7c608e3514f9e97da48065aecb470f888d031a34a0cd07b`

Upstream notice text summary:

- Copyright 2026 HKUDS contributors.
- Bundles Microsoft Qlib feature definitions under Apache-2.0 with additional NOTICE files in the upstream tree.
- Reimplements factor formulas derived from public research papers and reports; prose, tables, and figures are explicitly not reproduced upstream.

QuantOS-specific obligations:

1. Preserve MIT attribution for any retained upstream files or derived patch queue material.
2. Re-check the upstream nested notices before admitting any Alpha Zoo or factor-related material into a future adapter.
3. Keep TP01 outputs documented in [`UPSTREAM.md`](./UPSTREAM.md) and the TP01 ADR before any sync reaches `engines/vibe-adapter`.
