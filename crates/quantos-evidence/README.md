# quantos-evidence

Release evidence package for the L04 go/no-go review.

## Scope

- `SloReport`: load verification over X03/X04 issuance and order paths — zero duplicate commands, zero duplicate orders, 100% persisted audit signatures, measured P95 issuance latency (latency is reported but excluded from the evidence hash)
- `DrillReport`: four drills — replay (10k-event golden hash), recovery (post-crash rebuild equals uninterrupted projection), engine failure (classified venue outage with clean retry), and kill switch (100 risk denials plus blocked issuance)
- `ReleaseChecklist`: checklist items bound to evidence hashes (SLO, drills, security scan, L03 dual-approval audit)
- `EvidencePackage`: tamper-evident canonical hash over all reports; `go_no_go_ready()` requires SLO pass, all drills pass, checklist pass, and zero critical security findings

## Validation

- `cargo test -p quantos-evidence`
