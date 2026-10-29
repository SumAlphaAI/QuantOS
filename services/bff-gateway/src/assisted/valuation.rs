//! Current X01 valuation reads the current native ledger and an explicit owner
//! authenticated source port. Neither a browser price nor a cached ready result
//! can replace a missing, invalid, stale or quarantined current source.
use super::*;
use quantos_portfolio::native_valuation::{Inputs, TRUST};
impl OwnedHost {
    pub(super) fn sync_valuation(
        &mut self,
        session: &str,
        at: DateTime<Utc>,
    ) -> Result<Value, Error> {
        let ledger_view = self.sync_ledger(session, at)?;
        let ledger = self.ledger.as_ref().ok_or(Error::Unavailable)?;
        self.valuation
            .validate(ledger)
            .map_err(|_| Error::Unavailable)?;
        let generation = self.sources.kill_status(ledger.scope().account_id)?["revision"]
            .as_u64()
            .ok_or(Error::Unavailable)?;
        let input = self
            .valuation_input
            .as_ref()
            .map(|s| s.lock())
            .transpose()?
            .map(|s| s.read())
            .transpose()
            .ok()
            .flatten()
            .flatten();
        let mut view = json!({"schemaVersion":"quantos-native-valuation-view.v1","tenantId":ledger.scope().tenant_id,"workspaceId":ledger.scope().workspace_id,"accountId":ledger.scope().account_id,"mode":"assisted_live","checkedAt":at,"expiresAt":at+Duration::seconds(8),"ledgerHash":ledger_view["ledgerHash"],"ledgerAnchor":ledger.anchor(),"killGeneration":generation.to_string(),"quarantinedCommandCount":ledger_view["quarantinedCommandCount"],"riskInputReady":false,"reason":"SOURCE_UNAVAILABLE","sourceTrust":TRUST,"executionAuthority":false});
        if ledger_view["consumerReady"] != true {
            view["reason"] = json!("UNKNOWN_OR_QUARANTINED_OBLIGATIONS");
        }
        if let Some(input) = input {
            let input: Inputs = serde_json::from_value(input).map_err(|_| Error::Unavailable)?;
            let evaluated = self
                .valuation
                .observe(ledger, &input, generation, at)
                .map_err(|_| Error::Unavailable)?;
            view["sourceHash"] = json!(input.content_hash().map_err(|_| Error::Unavailable)?);
            view["sourceVersion"] = json!(input.version.to_string());
            view["reason"] = json!(evaluated.reason);
            if let Some(snapshot) = evaluated.snapshot {
                snapshot
                    .validate_for(ledger, &input, generation, at)
                    .map_err(|_| Error::Unavailable)?;
                view["riskInputReady"] = json!(true);
                view["expiresAt"] = json!((at + Duration::seconds(8)).min(snapshot.expires_at));
                view["snapshot"] = json!(snapshot);
            }
        }
        let (sources, snapshots) = self.valuation.counts();
        view["sourceVersions"] = json!(sources);
        view["snapshotCount"] = json!(snapshots);
        Ok(view)
    }
}
