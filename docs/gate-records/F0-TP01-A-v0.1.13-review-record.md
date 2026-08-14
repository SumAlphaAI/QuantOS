# F0 TP01-A v0.1.13 Governance Review Record

- Review date: 2026-08-14
- Upstream: `HKUDS/Vibe-Trading`
- Controlled fork: `sumalphai/Vibe-Trading`
- Approved tag: `v0.1.13`
- Approved commit: `c33133f4fd5e978d21d2a61fdd8787fb352b4687`
- Result: `passed`

## Evidence

1. `third_party/vibe-trading/upstream-src` is pinned to the approved commit;
   its `upstream` fetch URL is the official repository and its push URL is
   `DISABLED`.
2. `baseline.lock.json`, `repository.lock.json`, `UPSTREAM.md`, SPDX SBOM,
   NOTICE, dependency digests, and CVE evidence all identify v0.1.13.
3. `pip-audit 2.9.0 --disable-pip` audited 185 pinned dependencies and reported
   zero known vulnerabilities; raw JSON is archived alongside the baseline.
4. Remote branches `sumalphai/tp01-base` and
   `sumalphai/tp01-integration` both resolve to the approved commit.
5. GitHub API verification confirms that both branches enforce strict required
   checks, administrator enforcement, two approving reviews, stale approval
   dismissal, last-push approval, linear history, conversation resolution, and
   prohibit force pushes and deletion.
6. TP01-B capability inventory, threat model, forbidden-coupling list, S0–S3
   sync policy, decision records, and candidate-only monitoring are archived.

## Commands and results

| Command | Result |
| --- | --- |
| `make tp01-vibe-provision` | passed; governance applied and API-readback verified |
| `make tp01-vibe-repository-check` | passed; readonly, fork refs, and protection verified |
| `make tp01-vibe-readonly-check` | passed; positive and mutated-origin negative fixtures passed |
| `make tp-intake-check` | passed |
| `make lint` | passed for Rust, Python, and TypeScript |

## Residual risk

The fine-grained administration token is an operator-only input. It is excluded
from Git, build artifacts, and logs. Routine upstream monitoring remains
read-only and does not receive the token.
