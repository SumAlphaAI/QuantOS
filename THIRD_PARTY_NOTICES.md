# Third-Party Notices

This repository tracks third-party dependency obligations here.

## Process

1. Generate dependency inventories in CI.
2. Review new licenses before merging.
3. Record any attribution, notice, or distribution obligations in this file.
4. Link exceptions or legal decisions from `docs/adr/` once those ADRs exist.

## Current Status

- F02 baseline created the notice registry.
- Dependency-specific notice entries are appended as packages are introduced beyond the F01 starter toolchain.

## TLS trust-store data

- Package: `webpki-root-certs 1.0.9`
- License: `CDLA-Permissive-2.0`
- Use: transitive TLS trust-store data through `reqwest` / `rustls-platform-verifier`.
- Conclusion: approved permissive data license; attribution is retained in the generated SBOM and this notice.

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

## F02: complete build-tool inventory

- Exact npm dependency licenses are recorded in the release `notices/node-licenses.json`; Python licenses are recorded in the CI evidence.
- `@img/sharp-libvips-*` 1.3.3 and sharp native/WASM platform packages 0.35.4 include LGPL-3.0-or-later components. Their conditional approval is limited to static Web build tooling, per [F02 license decision](docs/adr/20260917-f02-license-intake.md). They are not included in the runtime release bundle; distributing a Node image server/native image-processing bundle requires a new review.
- Upstream license/source locations: https://github.com/lovell/sharp-libvips and https://github.com/libvips/libvips . Retain the packages' LICENSE/THIRD-PARTY-NOTICES when handling their build environments or redistributing those packages.
- CC-BY-4.0 (`caniuse-lite` browser data), BlueOak-1.0.0 (the enumerated npm tooling), CC0-1.0 (`spdx-license-ids`), 0BSD (`tslib`) and PSF-2.0 (`typing_extensions` and Python tooling) are approved for this baseline.
