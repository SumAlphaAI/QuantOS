# TP01 Vibe-Trading Upstream Monitor

- checked at: `2026-10-08T12:29:07.668Z`
- locked baseline: `v0.1.13` @ `c33133f4fd5e978d21d2a61fdd8787fb352b4687`
- latest upstream tag: `v0.1.16` @ `e1dbea8ad3077569ff86f86ee5cb9b7c5e068ebb`
- latest upstream main: `14cabaf1958a4ca5001084b02f1afb026a9d5593`

## Candidates

### S3: upstream main advanced beyond locked baseline

- reason: research drift detected on the default branch; record candidate only
- target ref: `main@14cabaf1958a4ca5001084b02f1afb026a9d5593`
- action: open or update a research-only decision record; do not change production dependencies

### S1: new upstream release tag detected

- reason: locked baseline v0.1.13 differs from latest upstream tag v0.1.16
- target ref: `v0.1.16@e1dbea8ad3077569ff86f86ee5cb9b7c5e068ebb`
- digest drift: {"license":"b155549b8bc4e43a9b96b2288dbf4eb1bc0c697f14b3f5ec6b36bf64d5a18679","notice":"a898503c041b27d1046748144666a1309b6b25fa4d75a1b0a06ce2f8acd3b07c","requirementsLock":"3cda4b3d926a71bdcf5a9cd0be50743f0c1c4e4f35838e9b1d534582afdeac03","pyprojectToml":"b2ac27cc2b4366eacaa224d2614211f88673ba957eaebd6582e74b93276abfcd"}
- action: run license and dependency diff review before any sync candidate may proceed

