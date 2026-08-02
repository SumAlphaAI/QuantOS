# quantos-reconcile

Shadow running, end-of-day reconciliation, and exception queue for QuantOS.

## Scope

- `ShadowRunner`: comparison advice against live market data with a virtual ledger; the struct holds no venue adapter, so shadow sessions cannot call submit at the type level (`submitted_to_venue` is forced to `false`)
- `reconcile_day`: end-of-day comparison across orders, fills, positions, and the shadow ledger with twenty locatable `BreakKind` variants (order/fill/position/ledger families) and a 15-minute detection SLA constant
- `ExceptionQueue`: anomaly lifecycle `open -> acknowledged -> closed` with transition enforcement and resolution capture

## Validation

- `cargo test -p quantos-reconcile`
