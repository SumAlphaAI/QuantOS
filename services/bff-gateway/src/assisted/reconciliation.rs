//! Scoped read-only X05 composition, with a pinned independent observer and an
//! authenticated durable evidence outbox. Never alters commands or postings.
use super::*;
use openssl::{
    hash::MessageDigest,
    pkey::{PKey, Public},
    sign::Verifier,
    x509::X509,
};
use quantos_portfolio::native_ledger::Anchor;
use quantos_reconcile::current::{CurrentReconciliation, Input, ProtocolJournal};
pub(super) struct ObserverReader {
    path: std::path::PathBuf,
    key: PKey<Public>,
    pub(super) identity: String,
}
impl ObserverReader {
    pub(super) fn has_account_input(&self) -> Result<bool, Error> {
        match std::fs::symlink_metadata(self.path.with_file_name("account-books.json")) {
            Ok(_) => Ok(true),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(_) => Err(Error::Unavailable),
        }
    }
    pub(super) fn new(directory: &std::path::Path, pem: &[u8], pin: &str) -> Result<Self, Error> {
        let cert = X509::from_pem(pem).map_err(|_| Error::Unavailable)?;
        if execution_gateway::restricted_zone::fingerprint(&cert).map_err(|_| Error::Unavailable)?
            != pin
        {
            return Err(Error::Unavailable);
        }
        Ok(Self {
            path: directory.join("observer.json"),
            key: cert.public_key().map_err(|_| Error::Unavailable)?,
            identity: pin.into(),
        })
    }
    fn read(&self) -> Result<ProtocolJournal, Error> {
        let payload =
            self.read_payload(&self.path, "quantos-x05-independent-observer-signature/v1")?;
        let book: ProtocolJournal =
            serde_json::from_value(payload).map_err(|_| Error::Unavailable)?;
        if book.source_id != self.identity {
            return Err(Error::Unavailable);
        }
        Ok(book)
    }
    fn account_books(&self) -> Result<quantos_reconcile::account_books::Books, Error> {
        let path = self.path.with_file_name("account-books.json");
        let payload =
            self.read_payload(&path, "quantos-x05-independent-account-books-signature/v1")?;
        let book: quantos_reconcile::account_books::Books =
            serde_json::from_value(payload).map_err(|_| Error::Unavailable)?;
        if book.source_id != self.identity {
            return Err(Error::Unavailable);
        }
        Ok(book)
    }
    fn read_payload(&self, path: &std::path::Path, domain: &str) -> Result<Value, Error> {
        let metadata = std::fs::symlink_metadata(path).map_err(|_| Error::Unavailable)?;
        if !metadata.is_file() || metadata.len() > 4 * 1024 * 1024 {
            return Err(Error::Unavailable);
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::{MetadataExt, PermissionsExt};
            if metadata.permissions().mode() & 0o077 != 0 || metadata.nlink() != 1 {
                return Err(Error::Unavailable);
            }
        }
        #[derive(serde::Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Envelope {
            payload: Value,
            signature: String,
        }
        let value: Envelope =
            serde_json::from_slice(&std::fs::read(path).map_err(|_| Error::Unavailable)?)
                .map_err(|_| Error::Unavailable)?;
        if value.signature.len() > 8192
            || !value.signature.len().is_multiple_of(2)
            || !value.signature.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err(Error::Unavailable);
        }
        let signature = (0..value.signature.len())
            .step_by(2)
            .map(|i| {
                u8::from_str_radix(&value.signature[i..i + 2], 16).map_err(|_| Error::Unavailable)
            })
            .collect::<Result<Vec<_>, _>>()?;
        let bytes = canonical_json_bytes(&json!([domain, value.payload]))
            .map_err(|_| Error::Unavailable)?;
        let mut verifier =
            Verifier::new(MessageDigest::sha256(), &self.key).map_err(|_| Error::Unavailable)?;
        verifier.update(&bytes).map_err(|_| Error::Unavailable)?;
        if !verifier
            .verify(&signature)
            .map_err(|_| Error::Unavailable)?
        {
            return Err(Error::Unavailable);
        }
        Ok(value.payload)
    }
}
impl OwnedHost {
    pub(super) fn sync_reconciliation(
        &mut self,
        session: &str,
        at: DateTime<Utc>,
    ) -> Result<Value, Error> {
        let store = self.book_input_fence.clone();
        let _guard = store.as_ref().map(|s| s.lock()).transpose()?;
        self.sync_reconciliation_locked(session, at)
    }
    /// Caller holds the stable account-books publisher fence (and, for IO, the
    /// valuation/approval locks) so all readers see complete source publication.
    pub(super) fn sync_reconciliation_locked(
        &mut self,
        session: &str,
        at: DateTime<Utc>,
    ) -> Result<Value, Error> {
        self.service.capabilities(session, at)?;
        self.sync_ledger(session, at)?;
        let ledger = self.ledger.as_ref().ok_or(Error::Unavailable)?;
        let view = ledger.view().map_err(|_| Error::Unavailable)?;
        let scope = quantos_portfolio::native_ledger::Scope {
            tenant_id: serde_json::from_value(view["tenantId"].clone())
                .map_err(|_| Error::Unavailable)?,
            workspace_id: serde_json::from_value(view["workspaceId"].clone())
                .map_err(|_| Error::Unavailable)?,
            account_id: serde_json::from_value(view["accountId"].clone())
                .map_err(|_| Error::Unavailable)?,
        };
        let mut sources = vec![];
        for id in self.requests.keys() {
            if let Some(f) = self.native.execution_facts(session, *id, at)? {
                sources.push(f);
            }
        }
        let origin = self
            .observer
            .as_ref()
            .map(|r| r.identity.clone())
            .unwrap_or_else(|| "UNCONFIGURED_INDEPENDENT_BOOKS".into());
        // Missing/bad independent observations are unavailable, never a clean
        // empty book. The durable outbox/last verified high-water survives.
        let books = self.observer.as_ref().and_then(|r| r.read().ok());
        // A separate signed statement, not protocol-journal normalization or a
        // copy of X01 balances. Only a previously authenticated X01 origin is
        // used on the local side; no current mark is fabricated for this read.
        let account_books = self.observer.as_ref().and_then(|r| r.account_books().ok());
        let account_basis = self
            .valuation
            .verified_opening(ledger)
            .map_err(|_| Error::Unavailable)?
            .as_ref()
            .map(quantos_reconcile::account_books::Basis::from_valuation)
            .transpose()
            .map_err(|_| Error::Unavailable)?;
        let tx = self
            .reconciliation_store
            .as_ref()
            .map(|s| s.lock())
            .transpose()?;
        let stored = tx.as_ref().map(|s| s.read()).transpose()?.flatten();
        if stored.is_none()
            && (self.reconciliation.is_some() || self.reconciliation_anchor != Anchor::default())
            && self.reconciliation_store.is_some()
        {
            return Err(Error::Unavailable);
        }
        let mut state = match stored.as_ref() {
            Some(v) => CurrentReconciliation::restore(scope.clone(), origin.clone(), v),
            None => self
                .reconciliation
                .clone()
                .map(Ok)
                .unwrap_or_else(|| CurrentReconciliation::new(scope.clone(), origin.clone())),
        }
        .map_err(|_| Error::Unavailable)?;
        state
            .verify_anchor(&self.reconciliation_anchor)
            .map_err(|_| Error::Unavailable)?;
        if let Some(old) = &self.reconciliation {
            state
                .verify_anchor(&old.anchor())
                .map_err(|_| Error::Unavailable)?;
        }
        let changed = state
            .observe(Input {
                scope,
                origin_id: origin,
                sources,
                ledger_checkpoint: ledger.checkpoint().map_err(|_| Error::Unavailable)?,
                books,
                checked_at: at,
                account_books,
                account_basis,
                account_books_checked: true,
            })
            .map_err(|_| Error::Unavailable)?;
        if let Some(tx) = tx
            && (changed || stored.is_none())
        {
            tx.write(&state.checkpoint().map_err(|_| Error::Unavailable)?)?;
        }
        let result = state.view().map_err(|_| Error::Unavailable)?;
        self.reconciliation_anchor = state.anchor();
        self.reconciliation = Some(state);
        Ok(result)
    }
}
