//! Called under the common source publisher fence, including reservation/IO.
use super::*;
use quantos_portfolio::{
    market_provenance::{Binding, Policy, SignedArtifact},
    native_valuation::Inputs,
};
impl OwnedHost {
    pub(super) fn bind_market_input(
        &mut self,
        input: &mut Inputs,
        at: DateTime<Utc>,
    ) -> Result<(), Error> {
        // No public or raw owner-input metadata can assert that authentication ran.
        if input.market_provenance.is_some() {
            return Err(Error::PolicyChanged);
        }
        if !self.r01_valuation_enabled && !self.valuation.market_required() {
            return Ok(());
        }
        let store = self.r01_policy_store.as_ref().ok_or(Error::Unavailable)?;
        let p: Policy = serde_json::from_value(store.lock()?.read()?.ok_or(Error::Unavailable)?)
            .map_err(|_| Error::Unavailable)?;
        let pem = self.r01_certificate.clone().ok_or(Error::Unavailable)?;
        let pin = self
            .observer
            .as_ref()
            .ok_or(Error::Unavailable)?
            .identity
            .clone();
        if p.signer != pin || !input.marks.is_empty() {
            return Err(Error::PolicyChanged);
        }
        self.valuation
            .observe_market_policy(&p, &input.scope)
            .map_err(|_| Error::PolicyChanged)?;
        let path = self
            .control_fixture_directory
            .as_ref()
            .ok_or(Error::Unavailable)?
            .join("r01-valuation-artifact.json");
        let m = std::fs::symlink_metadata(&path).map_err(|_| Error::Unavailable)?;
        if !m.is_file() || m.len() > 262144 {
            return Err(Error::Unavailable);
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::{MetadataExt, PermissionsExt};
            if m.permissions().mode() & 0o077 != 0 || m.nlink() != 1 {
                return Err(Error::Unavailable);
            }
        }
        let a: SignedArtifact =
            serde_json::from_slice(&std::fs::read(path).map_err(|_| Error::Unavailable)?)
                .map_err(|_| Error::Unavailable)?;
        self.valuation
            .observe_market_artifact(&a, &p, &pem)
            .map_err(|_| Error::PolicyChanged)?;
        let binding = Binding {
            policy: p,
            artifact: a,
            certificate: pem,
        };
        let (marks, _) = binding
            .marks(
                &input.scope,
                &input.raw_market_hash().map_err(|_| Error::Unavailable)?,
                at,
            )
            .map_err(|_| Error::PolicyChanged)?;
        input.marks = marks;
        input.market_provenance = Some(binding);
        Ok(())
    }
}
