//! Owner-only local state. C01/F06 remain explicit reference adapters. No keys
//! are included in checkpoints. Approval/current native reservations use separate
//! synced files; the common audit projection is rebuilt solely from those facts.
use super::*;
use quantos_execution::durable::{DurableStore, LockedStore};
impl OwnedHost {
    pub(crate) fn has_correlation(&self, id: &str) -> bool {
        self.activation.id().to_string() == id
            || self.controls.has_correlation(id)
            || self.requests.keys().any(|r| r.to_string() == id)
            || self
                .alert_inbox
                .as_ref()
                .is_some_and(|i| i.rows().iter().any(|r| r["correlationId"] == id))
    }
    pub(crate) fn restricted(c: RestrictedReference) -> Result<Self, Error> {
        if !c.directory.is_absolute()
            || c.expires_at <= c.created_at
            || c.expires_at - c.created_at > Duration::minutes(15)
            || c.keys
                .iter()
                .enumerate()
                .any(|(i, k)| k.iter().all(|b| *b == 0) || c.keys[..i].contains(k))
        {
            return Err(Error::Invalid);
        }
        let mut h = Self::configured(
            c.enabled,
            c.created_at,
            c.expires_at,
            [c.keys[0], c.keys[1], c.keys[2]],
            Some(HostKernel::Restricted(Box::new(c.kernel))),
        )?;
        h.control_fixture_directory = Some(c.directory.clone());
        h.native =
            h.native
                .with_durable(DurableStore::new(&c.directory, "commands", c.keys[3])?)?;
        h.alert_store = Some(DurableStore::new(&c.directory, "alerts", c.keys[3])?);
        h.ledger_store = Some(DurableStore::new(&c.directory, "portfolio", c.keys[3])?);
        h.reconciliation_store = Some(DurableStore::new(
            &c.directory,
            "reconciliation",
            c.keys[3],
        )?);
        h.observer = c
            .observer_certificate
            .as_ref()
            .map(|(pem, pin)| super::reconciliation::ObserverReader::new(&c.directory, pem, pin))
            .transpose()?;
        h.durable = Some(Arc::new(DurableStore::new(
            &c.directory,
            "approvals",
            c.keys[3],
        )?));
        Ok(h)
    }
    pub(super) fn common_audit(&self) -> Result<Vec<Value>, Error> {
        let (entries, anchor) = self.service.audit_snapshot()?;
        self.service.verify_audit(&entries, &anchor)?;
        let mut all = vec![];
        for id in self.requests.keys() {
            let mut chain = vec![];
            let subject = self.subject(*self.requests.get(id).ok_or(Error::Invalid)?)?;
            let actor = subject["originator"].clone();
            let opened = *self.opened_at.get(id).ok_or(Error::Invalid)?;
            let mut add = |kind: &str, at: DateTime<Utc>, actor: Value, payload: Value| {
                let event_id = event_id(&format!("{id}:{kind}:{}", chain.len()));
                let cause = chain
                    .last()
                    .map(|v: &Value| v["eventId"].clone())
                    .unwrap_or(json!(event_id));
                let hash = crate::audit_core::payload_hash(&payload);
                chain.push(json!({"auditRef":event_id,"eventId":event_id,"correlationId":id,"causationId":cause,"sequence":chain.len()+1,"kind":kind,"actor":actor,"objectRef":format!("assisted-request:{id}"),"occurredAt":at,"route":format!("/orders?approvalId={id}"),"redactionApplied":true,"redactedPayload":payload,"payloadHash":hash,"retentionUntil":opened+Duration::days(90)}));
            };
            add(
                "assisted.request_opened",
                opened,
                actor.clone(),
                json!({"requestId":id,"subjectHash":subject["subjectHash"],"proposalHash":subject["proposalHash"],"decisionId":subject["decisionId"],"source":self.sources.provenance(*self.requests.get(id).ok_or(Error::Invalid)?)?}),
            );
            for a in entries.iter().filter(|a| a.request == *id) {
                add(
                    "assisted.independent_approval",
                    a.at,
                    json!(a.actor),
                    json!({"requestId":id,"subjectHash":a.subject_hash,"approvalSignature":a.signature,"slot":a.slot}),
                );
            }
            for fact in self
                .native
                .audit_facts()?
                .into_iter()
                .filter(|f| f["requestId"] == id.to_string())
            {
                let at: DateTime<Utc> =
                    serde_json::from_value(fact["issuedAt"].clone()).map_err(|_| Error::Invalid)?;
                add(
                    "assisted.command_reserved",
                    at,
                    actor.clone(),
                    json!({"requestId":id,"subjectHash":fact["subjectHash"],"commandId":fact["commandId"]}),
                );
                if fact["completed"] == true {
                    let mut payload = json!({"requestId":id,"subjectHash":fact["subjectHash"],"commandId":fact["commandId"],"orderId":fact["orderId"],"state":fact["state"]});
                    if !fact["executionFactsHash"].is_null() {
                        payload["executionFactsHash"] = fact["executionFactsHash"].clone();
                        payload["fillIds"] = fact["fillIds"].clone();
                    }
                    add(
                        if fact["state"] == "accepted" {
                            "assisted.command_accepted"
                        } else {
                            "assisted.command_unknown"
                        },
                        at,
                        actor.clone(),
                        payload,
                    );
                }
            }
            all.extend(chain);
        }
        self.alert_audit(&mut all)?;
        self.control_audit(&mut all);
        self.activation_audit(&mut all);
        Ok(all)
    }
}
pub(super) fn event_id(text: &str) -> Uuid {
    let hash = ContentHash::sha256_bytes(text.as_bytes()).to_string();
    let mut bytes = *Uuid::parse_str(&hash[7..39])
        .expect("digest UUID")
        .as_bytes();
    // RFC 9562 custom deterministic UUID: set version 8 and RFC variant.
    // Raw digest bytes can carry invalid version/variant bits rejected by SDKs.
    bytes[6] = (bytes[6] & 0x0f) | 0x80;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    Uuid::from_bytes(bytes)
}
fn decode<T: serde::de::DeserializeOwned>(v: &Value) -> Result<T, Error> {
    serde_json::from_value(v.clone()).map_err(|_| Error::Unavailable)
}
pub(super) fn restore(state: &mut ProviderData, tx: &LockedStore) -> Result<bool, Error> {
    let value = tx.read()?; // Always authenticate current disk bytes under the stable OS lock.
    let initialized = value.is_some();
    if let Some(v) = value
        && state
            .assisted
            .as_ref()
            .ok_or(Error::Unavailable)?
            .persisted
            .as_ref()
            != Some(&v)
    {
        let h = state.assisted.as_mut().ok_or(Error::Unavailable)?;
        h.service.restore_checkpoint(&v["service"])?;
        h.subjects = decode(&v["subjects"])?;
        h.controls = v
            .get("controls")
            .map(decode)
            .transpose()?
            .unwrap_or_default();
        h.activation = v
            .get("activation")
            .map(decode)
            .transpose()?
            .unwrap_or_else(|| h.activation_origin.clone());
        h.native_anchor = v.get("nativeAnchor").cloned();
        h.requests = decode(&v["requests"])?;
        h.opened_at = decode(&v["openedAt"])?;
        h.ledger_anchor = if let Some(anchor) = v.get("ledgerAnchor") {
            decode(anchor)?
        } else {
            Default::default()
        };
        h.reconciliation_anchor = if let Some(anchor) = v.get("reconciliationAnchor") {
            decode(anchor)?
        } else {
            Default::default()
        };
        h.alert_anchor = v
            .get("alertAnchor")
            .map(decode)
            .transpose()?
            .unwrap_or_default();
        state.audits = decode(&v["c10Access"])?;
        h.open_keys = decode::<Vec<((String, String), ProposalId)>>(&v["openKeys"])?
            .into_iter()
            .collect();
        h.proofs = decode::<Vec<((String, String), Replay)>>(&v["proofs"])?
            .into_iter()
            .collect();
        // Restore the original windows; startup must not mint renewed sessions.
        if decode::<DateTime<Utc>>(&v["sessionExpiresAt"])? != state.session_expires_at {
            return Err(Error::Unauthorized);
        }
        state.session_active = decode(&v["sessionActive"])?;
        state.challenges = decode(&v["challenges"])?;
        state.reauth_grants = decode(&v["reauthGrants"])?;
        state.consumed_step_proofs = decode(&v["consumedStepProofs"])?;
        state.assisted.as_mut().ok_or(Error::Unavailable)?.persisted = Some(v);
    }
    {
        let h = state.assisted.as_ref().ok_or(Error::Unavailable)?;
        h.verify_native_anchor()?;
        h.sync_native_control()?;
        h.sync_activation()?;
    }
    state
        .assisted
        .as_mut()
        .ok_or(Error::Unavailable)?
        .load_alerts()?;
    if !state.session_active {
        state
            .assisted
            .as_ref()
            .ok_or(Error::Unavailable)?
            .service
            .revoke_session("session-current")?;
    }
    Ok(initialized)
}
pub(super) fn save(state: &mut ProviderData, tx: &LockedStore) -> Result<(), Error> {
    let h = state.assisted.as_ref().ok_or(Error::Unavailable)?;
    if !state.session_active {
        h.service.revoke_session("session-current")?;
    }
    h.verify_controls()?;
    h.verify_activation()?;
    let anchor = h.native_anchor_now()?;
    let mut value = json!({"activation":h.activation,"controls":h.controls,"nativeAnchor":anchor,"service":h.service.checkpoint()?,"subjects":h.subjects,"requests":h.requests,"openedAt":h.opened_at,"ledgerAnchor":h.ledger_anchor,"reconciliationAnchor":h.reconciliation_anchor,"alertAnchor":h.alert_anchor,"c10Access":state.audits.iter().filter(|e|e["kind"].as_str().is_some_and(|k|k.starts_with("audit."))).collect::<Vec<_>>(),"openKeys":h.open_keys.iter().collect::<Vec<_>>(),"proofs":h.proofs.iter().collect::<Vec<_>>(),"sessionActive":state.session_active,"sessionExpiresAt":state.session_expires_at,"challenges":state.challenges,"reauthGrants":state.reauth_grants,"consumedStepProofs":state.consumed_step_proofs});
    tx.write(&value)?;
    // Explicit owned-loopback drill only: owner file cannot be supplied via HTTP.
    if let Some(root) = &h.control_fixture_directory
        && h.controls.has_transition()
        && root.join("pause-control-after-commit").is_file()
    {
        std::fs::write(
            root.join("control-after-commit.marker"),
            b"COMMITTED_CONTROL_NOT_NATIVE_ACK",
        )
        .map_err(|_| Error::Unavailable)?;
        while root.join("pause-control-after-commit").is_file() {
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }
    if let Some(root) = &h.control_fixture_directory
        && h.activation.lease()?.version > 0
        && root.join("pause-activation-after-commit").is_file()
    {
        std::fs::write(
            root.join("activation-after-commit.marker"),
            b"COMMITTED_ACTIVATION_NOT_NATIVE_ACK",
        )
        .map_err(|_| Error::Unavailable)?;
        while root.join("pause-activation-after-commit").is_file() {
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }
    h.sync_native_control()?;
    h.sync_activation()?;
    let confirmed = h.native_anchor_now()?;
    if confirmed != anchor {
        value["nativeAnchor"] = confirmed;
        tx.write(&value)?;
    }
    let h = state.assisted.as_mut().ok_or(Error::Unavailable)?;
    h.native_anchor = Some(value["nativeAnchor"].clone());
    h.persisted = Some(value);
    Ok(())
}
/// Called by the existing public C10 reader, with current C01 authorization.
/// The stable disk lock also fences it against every cooperating local writer.
pub(crate) fn refresh_common(state: &mut ProviderData) -> Result<(), Error> {
    let Some(_) = state.assisted.as_ref() else {
        return Ok(());
    };
    state
        .assisted
        .as_mut()
        .ok_or(Error::Unavailable)?
        .load_alerts()?;
    let facts = state
        .assisted
        .as_ref()
        .ok_or(Error::Unavailable)?
        .common_audit()?;
    state.audits.retain(|e| {
        !e["kind"]
            .as_str()
            .is_some_and(|k| k.starts_with("assisted."))
    });
    state.audits.extend(facts);
    Ok(())
}

/// Fences every C01/F06/native/C10 request and persists even refusals which may
/// consume a proof. OS-lock acquisition runs off the async executor threads.
pub(crate) async fn transaction(
    State(data): State<Arc<Mutex<ProviderData>>>,
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> Response {
    let store = data
        .lock()
        .await
        .assisted
        .as_ref()
        .and_then(|h| h.durable.clone());
    let Some(store) = store else {
        return next.run(request).await;
    };
    let tx = match tokio::task::spawn_blocking(move || store.lock()).await {
        Ok(Ok(tx)) => tx,
        _ => return fail(Error::Unavailable).response(),
    };
    let pure_read = request.method() == Method::GET
        && matches!(
            request.uri().path(),
            "/v1/session" | "/v1/context" | "/v1/assisted-testnet/capabilities"
        );
    let initialized = {
        let mut state = data.lock().await;
        match restore(&mut state, &tx) {
            Ok(initialized) => initialized,
            Err(e) => return fail(e).response(),
        }
    };
    let response = next.run(request).await;
    // These exact handlers are pure identity/capability reads. Keep their OS
    // lock/current authenticated reload, but avoid rewriting the entire ledger.
    // First read still initializes shared state; all other paths persist even
    // refusals, including consumed MFA and C10 access audit records.
    if !pure_read || !initialized {
        let mut state = data.lock().await;
        if let Err(e) = save(&mut state, &tx) {
            return fail(e).response();
        }
    }
    response
}

/// Explicit fixture startup only: private temporary owner directory, loopback
/// address and .invalid DNS, ephemeral test CA/key. No dotenv or DB fallback.
pub(crate) fn load_owned(
    directory: &std::path::Path,
    enabled: bool,
) -> anyhow::Result<RestrictedReference> {
    use execution_gateway::restricted_zone::{NetworkAllowlist, ZoneClient, ZoneExecutionKernel};
    use openssl::{pkey::PKey, x509::X509};
    use std::{fs, net::SocketAddr};
    let root = directory.canonicalize()?;
    anyhow::ensure!(
        root == directory
            && root.parent() == Some(std::env::temp_dir().canonicalize()?.as_path())
            && root
                .file_name()
                .and_then(|v| v.to_str())
                .is_some_and(|n| n.starts_with("quantos-l02-")),
        "owned mTLS directory required"
    );
    let read = |name: &str| -> anyhow::Result<Vec<u8>> {
        let p = root.join(name);
        let m = fs::symlink_metadata(&p)?;
        anyhow::ensure!(m.is_file(), "regular owner file required");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            anyhow::ensure!(
                m.permissions().mode() & 0o077 == 0,
                "private owner file required"
            );
        }
        Ok(fs::read(p)?)
    };
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    struct Owner {
        address: SocketAddr,
        server_fingerprint: String,
        session_hash: String,
        keys: [[u8; 32]; 4],
        created_at: DateTime<Utc>,
        expires_at: DateTime<Utc>,
    }
    let c: Owner = serde_json::from_slice(&read("bff-owner.json")?)?;
    anyhow::ensure!(
        c.address.ip().is_loopback(),
        "owned endpoint must be loopback"
    );
    let ca = X509::from_pem(&read("ca.pem")?)?;
    let cert = X509::from_pem(&read("peer-1.pem")?)?;
    let key = PKey::private_key_from_pem(&read("peer-1-key.pem")?)?;
    let client = ZoneClient::new(
        &ca,
        &cert,
        &key,
        NetworkAllowlist::new(
            "execution-zone.invalid".into(),
            c.address.port(),
            [c.address.ip()].into(),
        )?,
        c.server_fingerprint.clone(),
    )?;
    Ok(RestrictedReference {
        observer_certificate: Some((read("server.pem")?, c.server_fingerprint.clone())),
        directory: root,
        kernel: ZoneExecutionKernel::new(
            client,
            "execution-zone.invalid".into(),
            c.address,
            c.session_hash,
            1,
        )?,
        keys: c.keys,
        created_at: c.created_at,
        expires_at: c.expires_at,
        enabled,
    })
}
