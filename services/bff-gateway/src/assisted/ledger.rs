//! Owner-only X04 -> X01 ingestion. No public upload and no venue IO.
use super::*;
use quantos_portfolio::native_ledger::{Anchor, LegacyBinding, NativeLedger, Scope as LedgerScope};
impl OwnedHost {
    pub(super) fn sync_ledger(&mut self, session: &str, at: DateTime<Utc>) -> Result<Value, Error> {
        // Current C01/native authorization is checked even for an empty ledger.
        self.service.capabilities(session, at)?;
        let scope = &self
            .subjects
            .values()
            .next()
            .ok_or(Error::Unavailable)?
            .scope;
        let scope = LedgerScope {
            tenant_id: scope.tenant,
            workspace_id: scope.workspace,
            account_id: scope.account,
        };
        // Read trusted native sources first. Never hold the ledger lock while
        // calling native or consume a DTO uploaded by an HTTP client.
        let mut observations = vec![];
        for id in self.requests.keys() {
            if let Some(c) = self.native.inspect(session, *id, at)? {
                let facts = self.native.execution_facts(session, *id, at)?;
                observations.push((c, facts));
            }
        }
        let tx = self.ledger_store.as_ref().map(|s| s.lock()).transpose()?;
        let stored = tx.as_ref().map(|t| t.read()).transpose()?.flatten();
        if stored.is_none()
            && (self.ledger.is_some() || self.ledger_anchor != Anchor::default())
            && self.ledger_store.is_some()
        {
            return Err(Error::Unavailable);
        }
        let mut ledger = match stored.as_ref() {
            Some(v) => NativeLedger::restore(scope, v).map_err(|_| Error::Unavailable)?,
            None => self
                .ledger
                .clone()
                .map(Ok)
                .unwrap_or_else(|| NativeLedger::new(scope))
                .map_err(|_| Error::Unavailable)?,
        };
        ledger
            .verify_anchor(&self.ledger_anchor)
            .map_err(|_| Error::Unavailable)?;
        if let Some(previous) = &self.ledger {
            ledger
                .verify_anchor(&previous.anchor())
                .map_err(|_| Error::Unavailable)?;
        }
        let before = ledger.anchor();
        if ledger
            .command_ids()
            .any(|id| !observations.iter().any(|(c, _)| c.command_id == id))
        {
            return Err(Error::Unavailable);
        }
        for (c, facts) in observations {
            if let Some(facts) = facts {
                ledger.observe(&facts).map_err(|_| Error::Unavailable)?;
            } else {
                ledger
                    .observe_legacy(LegacyBinding {
                        request_id: c.request_id,
                        command_id: c.command_id,
                        subject_hash: c.subject_hash,
                    })
                    .map_err(|_| Error::Unavailable)?;
            }
        }
        let changed = ledger.anchor() != before;
        if let Some(tx) = tx
            && (changed || stored.is_none())
        {
            tx.write(&ledger.checkpoint().map_err(|_| Error::Unavailable)?)?;
        }
        let view = ledger.view().map_err(|_| Error::Unavailable)?;
        self.ledger_anchor = ledger.anchor();
        self.ledger = Some(ledger);
        Ok(view)
    }
}
