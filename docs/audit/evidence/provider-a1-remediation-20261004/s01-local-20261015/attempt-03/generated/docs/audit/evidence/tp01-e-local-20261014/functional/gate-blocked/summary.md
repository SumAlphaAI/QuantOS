# TP01-E Vibe Sync Decisions

- generated at: `2026-10-15T03:41:01.230Z`
- baseline: `v0.1.13` @ `c33133f4fd5e978d21d2a61fdd8787fb352b4687`
- decisions: `2`
- execution mode: `gate`
- monitoring status: `COMPLETED`
- sync gate status: `BLOCKED`
- blocked candidates: `1`
- sync approved: `false` (candidate classification does not authorize adoption)

## S3 main advanced synthetic reference

- candidate ref: `main@1111111111111111111111111111111111111111`
- blocked: `false`
- issue title: TP01-E [S3] main@1111111111111111111111111111111111111111
- reasons:
  - candidate is research-only and should remain outside the default capability registry
  - Synthetic monitoring input; no adoption authorized

## S1 Synthetic dependency drift

- candidate ref: `v-local@2222222222222222222222222222222222222222`
- blocked: `true`
- issue title: TP01-E [S1] v-local@2222222222222222222222222222222222222222
- reasons:
  - dependency manifest drift requires compatibility review
  - QuantOS-owned negative fixture

