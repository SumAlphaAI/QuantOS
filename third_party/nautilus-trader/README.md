# TP07 fixed candidate evaluation

Pinned upstream `fa86c6e39e8f064d5922c0ee4da5e2a9a2716408`; exact local Git blobs, not the mutable reference checkout HEAD. Source-evidence contains descriptors, lockfiles, license and documentation only. No upstream implementation is installed, imported, built or executed. Raw file SHA-256 and Git blob identity are checked offline.

`python3 scripts/tp07-evaluation.py` verifies baseline, full SPDX 2.3 lock inventory, advisory request/response binding, capability inventory and production exclusion. `--runtime` always refuses. `--generate` only generates the deterministic evaluation SBOM and public advisory request; it does not resolve/install anything.

SBOM includes every Cargo/uv lock entry, including development/optional/unselected-platform packages. It is not a deployed runtime SBOM. Transitive licenses remain NOASSERTION. The public OSV snapshot records package/version matches, not a claim that the candidate is vulnerability-free. Offline replay never refreshes the public database. Missing/failed network queries remain UNKNOWN_NETWORK; unpublished/path/Git packages and actual target compatibility stay unassessed. All runtime admission remains DENIED.

License declarations at this exact commit are LGPL-3.0-or-later in both manifests. The historical LGPL-3.0-only ADR statement was incorrect. Process separation is an engineering boundary, not automatic legal approval. Production/distribution, legal review, source/notices/replaceability obligations and target safety remain independent gates.
