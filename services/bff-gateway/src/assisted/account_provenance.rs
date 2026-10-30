//! Independent owner-approved account source under the same publisher/IO fence.
use super::*;
use quantos_portfolio::{
    account_provenance::{Binding, Policy, SignedArtifact},
    native_valuation::Inputs,
};
impl OwnedHost {
    pub(super) fn bind_account_input(
        &mut self,
        input: &mut Inputs,
        at: DateTime<Utc>,
    ) -> Result<(), Error> {
        if input.account_provenance.is_some() {
            return Err(Error::PolicyChanged);
        }
        if !self.account_valuation_enabled && !self.valuation.account_required() {
            return Ok(());
        }
        if !self.r01_valuation_enabled && !self.valuation.market_required() {
            return Err(Error::Unavailable);
        }
        let p: Policy = serde_json::from_value(
            self.account_policy_store
                .as_ref()
                .ok_or(Error::Unavailable)?
                .lock()?
                .read()?
                .ok_or(Error::Unavailable)?,
        )
        .map_err(|_| Error::Unavailable)?;
        // A market/venue observer signer cannot acquire account funding authority.
        if self
            .observer
            .as_ref()
            .is_none_or(|o| o.identity == p.signer)
        {
            return Err(Error::PolicyChanged);
        }
        let account_cert = openssl::x509::X509::from_pem(p.certificate.as_bytes())
            .map_err(|_| Error::Unavailable)?;
        let market_cert = openssl::x509::X509::from_pem(
            self.r01_certificate
                .as_ref()
                .ok_or(Error::Unavailable)?
                .as_bytes(),
        )
        .map_err(|_| Error::Unavailable)?;
        if account_cert
            .public_key()
            .map_err(|_| Error::Unavailable)?
            .public_key_to_der()
            .map_err(|_| Error::Unavailable)?
            == market_cert
                .public_key()
                .map_err(|_| Error::Unavailable)?
                .public_key_to_der()
                .map_err(|_| Error::Unavailable)?
        {
            return Err(Error::PolicyChanged);
        }
        self.valuation
            .observe_account_policy(&p, &input.scope)
            .map_err(|_| Error::PolicyChanged)?;
        let path = self
            .control_fixture_directory
            .as_ref()
            .ok_or(Error::Unavailable)?
            .join("account-valuation-artifact.json");
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
            .observe_account_artifact(&a, &p)
            .map_err(|_| Error::PolicyChanged)?;
        let b = Binding {
            policy: p,
            artifact: a,
        };
        b.summary(input, at).map_err(|_| Error::PolicyChanged)?;
        input.account_provenance = Some(b);
        Ok(())
    }
}
