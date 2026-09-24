use std::collections::BTreeSet;

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::{DateTime, Utc};
use native_tls::TlsConnector;
use postgres::{Client, NoTls, Row, types::Type};
use postgres_native_tls::MakeTlsConnector;
use quantos_core::{AccountId, ActorId, TenantId, WorkspaceId};
use quantos_policy::{
    AuthorizationRequirement, Capability, PolicyContext, PolicyEngine, PolicyError, Role, RunMode,
    SecretAccessRequest,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use url::Url;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthContext {
    pub tenant_id: TenantId,
    pub actor_id: ActorId,
    pub user_id: Uuid,
    pub workspace_id: WorkspaceId,
    pub workspace_slug: String,
    pub workspace_name: String,
    pub role: Role,
    pub mode: RunMode,
    pub account_id: Option<AccountId>,
    pub capabilities: BTreeSet<Capability>,
}

impl AuthContext {
    #[must_use]
    pub fn policy_context(&self) -> PolicyContext {
        PolicyContext {
            tenant_id: self.tenant_id,
            actor_id: self.actor_id,
            workspace_id: self.workspace_id,
            account_id: self.account_id,
            role: self.role,
            mode: self.mode,
            capabilities: self.capabilities.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SecretAccessGrant {
    pub tenant_id: TenantId,
    pub actor_id: ActorId,
    pub secret_name: String,
    pub vault_path: String,
    pub required_capability: Capability,
    pub session_expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserRequestContext {
    pub user_id: Uuid,
    pub tenant_id: TenantId,
    pub mode: RunMode,
    pub account_id: Option<AccountId>,
}

#[derive(Debug, Error)]
pub enum AuthError {
    #[error(transparent)]
    Postgres(#[from] postgres::Error),
    #[error(transparent)]
    Url(#[from] url::ParseError),
    #[error(transparent)]
    Tls(#[from] native_tls::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Policy(#[from] PolicyError),
    #[error(transparent)]
    Http(#[from] reqwest::Error),
    #[error("Supabase Auth did not verify an active user session")]
    UnverifiedSession,
    #[error("user does not have exactly one active primary tenant/account context")]
    AmbiguousPrimaryContext,
    #[error("account is unavailable in the current session context")]
    HiddenAccount,
    #[error("execution database connection did not assume the dedicated gateway role")]
    ExecutionRoleRequired,
    #[error("BFF database connection did not assume the dedicated BFF role")]
    BffRoleRequired,
    #[error("database login is privileged or can directly read Vault")]
    UnsafeApplicationLogin,
    #[error("application database connections require verified TLS")]
    InsecureDatabaseTransport,
    #[error("identity mapping is missing for user `{user_id}` in tenant `{tenant_id}`")]
    MissingIdentityMapping { user_id: Uuid, tenant_id: TenantId },
    #[error(
        "secret allowlist entry `{secret_name}` is unavailable for the provided service session"
    )]
    SecretAccessDenied { secret_name: String },
}

/// Plaintext is confined to the execution process and never serialized or
/// included in Debug output. The database role and function provide the
/// authoritative authorization boundary.
pub struct ExecutionSecret(String);

impl ExecutionSecret {
    pub fn expose_to_venue_adapter(&self) -> &str {
        &self.0
    }
}

pub struct ExecutionSecretStore {
    client: Client,
}

impl ExecutionSecretStore {
    pub fn connect(database_url: &str) -> Result<Self, AuthError> {
        require_verified_transport(database_url)?;
        let mut client = connect_client(database_url)?;
        require_narrow_login(&mut client, ApplicationRole::Execution)?;
        client.batch_execute("set role quantos_execution_gateway")?;
        let role: String = client.query_one("select current_role::text", &[])?.get(0);
        if role != "quantos_execution_gateway" {
            return Err(AuthError::ExecutionRoleRequired);
        }
        Ok(Self { client })
    }

    pub fn resolve_for_command(
        &mut self,
        session_token_hash: &str,
        secret_name: &str,
        command_expires_at: DateTime<Utc>,
    ) -> Result<Option<ExecutionSecret>, AuthError> {
        let row = self.client.query_typed_one(
            "select quantos.resolve_execution_vault_secret($1, $2, $3) as value",
            &[
                (&session_token_hash, Type::TEXT),
                (&secret_name, Type::TEXT),
                (&command_expires_at, Type::TIMESTAMPTZ),
            ],
        )?;
        Ok(row.get::<_, Option<String>>("value").map(ExecutionSecret))
    }
}

/// A user identity constructed only after the Supabase Auth server validates
/// the access token. Client-provided subject or tenant headers are ignored.
pub struct VerifiedUser {
    id: Uuid,
    mfa_verified: bool,
    token_expires_at: DateTime<Utc>,
}

pub struct BffSessionContext {
    pub auth: AuthContext,
    pub mfa_verified: bool,
    pub expires_at: DateTime<Utc>,
}

pub struct SupabaseAuthVerifier {
    user_endpoint: Url,
    publishable_key: String,
    client: reqwest::blocking::Client,
}

impl SupabaseAuthVerifier {
    pub fn new(project_url: &str, publishable_key: String) -> Result<Self, AuthError> {
        let base = Url::parse(project_url)?;
        if base.scheme() != "https" || base.host_str().is_none() || publishable_key.is_empty() {
            return Err(AuthError::UnverifiedSession);
        }
        let user_endpoint = base.join("/auth/v1/user")?;
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()?;
        Ok(Self {
            user_endpoint,
            publishable_key,
            client,
        })
    }

    pub fn verify_access_token(&self, token: &str) -> Result<VerifiedUser, AuthError> {
        if token.is_empty() || token.chars().any(char::is_whitespace) {
            return Err(AuthError::UnverifiedSession);
        }
        let response = self
            .client
            .get(self.user_endpoint.clone())
            .header("apikey", &self.publishable_key)
            .bearer_auth(token)
            .send()?;
        if !response.status().is_success() {
            return Err(AuthError::UnverifiedSession);
        }
        let user: serde_json::Value = response.json()?;
        let id = user
            .get("id")
            .and_then(serde_json::Value::as_str)
            .and_then(|value| Uuid::parse_str(value).ok())
            .ok_or(AuthError::UnverifiedSession)?;
        if user
            .get("is_anonymous")
            .and_then(serde_json::Value::as_bool)
            == Some(true)
        {
            return Err(AuthError::UnverifiedSession);
        }
        verified_user_claims(token, id)
    }
}

// Called only after Supabase Auth verifies this exact bearer token. The claim
// checks bind MFA and expiry to the returned user and reject service tokens.
fn verified_user_claims(token: &str, id: Uuid) -> Result<VerifiedUser, AuthError> {
    let payload = token
        .split('.')
        .nth(1)
        .and_then(|value| URL_SAFE_NO_PAD.decode(value).ok())
        .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
        .ok_or(AuthError::UnverifiedSession)?;
    if payload.get("sub").and_then(serde_json::Value::as_str) != Some(id.to_string().as_str())
        || payload.get("role").and_then(serde_json::Value::as_str) != Some("authenticated")
    {
        return Err(AuthError::UnverifiedSession);
    }
    let token_expires_at = payload
        .get("exp")
        .and_then(serde_json::Value::as_i64)
        .and_then(|seconds| DateTime::<Utc>::from_timestamp(seconds, 0))
        .filter(|expires_at| *expires_at > Utc::now())
        .ok_or(AuthError::UnverifiedSession)?;
    let mfa_verified = payload.get("aal").and_then(serde_json::Value::as_str) == Some("aal2");
    Ok(VerifiedUser {
        id,
        mfa_verified,
        token_expires_at,
    })
}

pub struct PgAuthStore {
    client: Client,
}

impl PgAuthStore {
    pub fn connect(database_url: &str) -> Result<Self, AuthError> {
        Ok(Self {
            client: connect_client(database_url)?,
        })
    }

    pub fn connect_as_bff(database_url: &str) -> Result<Self, AuthError> {
        require_verified_transport(database_url)?;
        let mut client = connect_client(database_url)?;
        require_narrow_login(&mut client, ApplicationRole::Bff)?;
        client.batch_execute("set role quantos_bff")?;
        let role: String = client.query_one("select current_role::text", &[])?.get(0);
        if role != "quantos_bff" {
            return Err(AuthError::BffRoleRequired);
        }
        Ok(Self { client })
    }

    pub fn load_user_context(
        &mut self,
        user_id: Uuid,
        tenant_id: TenantId,
        mode: RunMode,
        account_id: Option<AccountId>,
    ) -> Result<AuthContext, AuthError> {
        let account_uuid = account_id.map(|id| *id.as_uuid());
        let rows = self.client.query_typed(
            "select a.id as actor_id,
                    a.user_id,
                    w.id as workspace_id,
                    w.slug as workspace_slug,
                    w.name as workspace_name,
                    wm.role,
                    array_remove(array_agg(distinct ac.capability), null) as capabilities
             from quantos.actors as a
             join quantos.workspace_memberships as wm
               on wm.actor_id = a.id and wm.tenant_id = a.tenant_id
             join quantos.workspaces as w
               on w.id = wm.workspace_id and w.tenant_id = a.tenant_id and w.is_primary = true
             left join quantos.actor_capabilities as ac
               on ac.actor_id = a.id
              and ac.tenant_id = a.tenant_id
              and (ac.mode_scope is null or ac.mode_scope = $3)
              and (ac.workspace_id is null or ac.workspace_id = w.id)
              and (ac.account_id is null or ac.account_id = $4)
             where a.user_id = $1
               and a.tenant_id = $2
               and a.actor_kind = 'user'
               and a.is_active = true
               and (
                 $4 is null
                 or exists (
                   select 1
                   from quantos.accounts as account
                   where account.id = $4
                     and account.tenant_id = a.tenant_id
                     and account.workspace_id = w.id
                     and account.mode = $3
                     and account.is_active = true
                 )
               )
             group by a.id, a.user_id, w.id, w.slug, w.name, wm.role
             order by w.is_primary desc
             limit 1",
            &[
                (&user_id, Type::UUID),
                (tenant_id.as_uuid(), Type::UUID),
                (&mode.as_str(), Type::TEXT),
                (&account_uuid, Type::UUID),
            ],
        )?;

        let row = rows
            .into_iter()
            .next()
            .ok_or(AuthError::MissingIdentityMapping { user_id, tenant_id })?;

        row_to_auth_context(row, tenant_id, mode, account_id)
    }

    fn load_primary_context(
        &mut self,
        user_id: Uuid,
        account_id: Option<AccountId>,
    ) -> Result<AuthContext, AuthError> {
        let selected = account_id.map(|id| *id.as_uuid());
        let rows = self.client.query_typed(
            "select distinct a.tenant_id, account.id as account_id, account.mode
             from quantos.actors as a
             join quantos.workspace_memberships as wm
               on wm.tenant_id = a.tenant_id and wm.actor_id = a.id
             join quantos.workspaces as w
               on w.tenant_id = a.tenant_id and w.id = wm.workspace_id and w.is_primary
             join quantos.accounts as account
               on account.tenant_id = a.tenant_id
              and account.workspace_id = w.id and account.is_active
             where a.user_id = $1 and a.actor_kind = 'user' and a.is_active
               and ($2::uuid is null or account.id = $2)
             order by a.tenant_id, account.id limit 2",
            &[(&user_id, Type::UUID), (&selected, Type::UUID)],
        )?;
        if rows.len() != 1 {
            return Err(AuthError::AmbiguousPrimaryContext);
        }
        let row = &rows[0];
        let mode = RunMode::parse(row.get::<_, String>("mode").as_str())?;
        self.load_user_context(
            user_id,
            TenantId::from_uuid(row.get("tenant_id")),
            mode,
            Some(AccountId::from_uuid(row.get("account_id"))),
        )
    }

    fn issue_bff_session(&mut self, user: &VerifiedUser) -> Result<String, AuthError> {
        // Issue only a session that can resolve to exactly one primary context.
        // A caller cannot select a second tenant or account with a request header.
        self.load_primary_context(user.id, None)?;
        let raw = Uuid::new_v4().to_string();
        let hash = session_hash(&raw);
        let expires = (Utc::now() + chrono::Duration::minutes(5)).min(user.token_expires_at);
        if expires <= Utc::now() {
            return Err(AuthError::UnverifiedSession);
        }
        self.client.execute_typed(
            "insert into quantos.bff_sessions(session_hash,user_id,expires_at,mfa_verified) values($1,$2,$3,$4)",
            &[
                (&hash, Type::TEXT),
                (&user.id, Type::UUID),
                (&expires, Type::TIMESTAMPTZ),
                (&user.mfa_verified, Type::BOOL),
            ],
        )?;
        Ok(raw)
    }

    fn load_bff_session_context(
        &mut self,
        raw: &str,
        account_id: Option<AccountId>,
    ) -> Result<BffSessionContext, AuthError> {
        let hash = session_hash(raw);
        let row = self
            .client
            .query_typed_opt(
                "select user_id, mfa_verified, expires_at from quantos.bff_sessions
             where session_hash=$1 and expires_at > now()",
                &[(&hash, Type::TEXT)],
            )?
            .ok_or(AuthError::UnverifiedSession)?;
        let auth = self.load_primary_context(row.get("user_id"), None)?;
        if account_id.is_some() && auth.account_id != account_id {
            return Err(AuthError::HiddenAccount);
        }
        Ok(BffSessionContext {
            auth,
            mfa_verified: row.get("mfa_verified"),
            expires_at: row.get("expires_at"),
        })
    }

    fn revoke_bff_session(&mut self, raw: &str) -> Result<(), AuthError> {
        let hash = session_hash(raw);
        self.client.execute_typed(
            "delete from quantos.bff_sessions where session_hash=$1",
            &[(&hash, Type::TEXT)],
        )?;
        Ok(())
    }

    pub fn load_service_secret_grant(
        &mut self,
        session_token_hash: &str,
        secret_name: &str,
        now: DateTime<Utc>,
    ) -> Result<SecretAccessGrant, AuthError> {
        let row = self.client.query_typed_opt(
            "select session.tenant_id,
                    session.actor_id,
                    secret.secret_name,
                    secret.vault_path,
                    secret.required_capability,
                    session.expires_at
             from quantos.execution_service_sessions as session
             join quantos.actors as actor
               on actor.id = session.actor_id
              and actor.tenant_id = session.tenant_id
              and actor.actor_kind = 'service'
              and actor.is_active = true
             join quantos.secret_references as secret
               on secret.tenant_id = session.tenant_id
              and secret.secret_name = $2
              and secret.rotation_state = 'active'
              and secret.account_id = session.account_id
              and secret.account_id is not null
             where session.session_token_hash = $1
               and session.revoked_at is null
               and session.expires_at > $3
               and exists (
                 select 1 from quantos.accounts as account
                 where account.tenant_id = session.tenant_id
                   and account.id = session.account_id
                   and account.is_active = true
                   and account.workspace_id = secret.workspace_id
               )
               and session.allowed_capability = secret.required_capability
               and exists (
                 select 1
                 from quantos.actor_capabilities as capability
                 where capability.actor_id = session.actor_id
                   and capability.tenant_id = session.tenant_id
                   and capability.capability = secret.required_capability
                   and capability.account_id = session.account_id
                   and capability.workspace_id = secret.workspace_id
               )",
            &[
                (&session_token_hash, Type::TEXT),
                (&secret_name, Type::TEXT),
                (&now, Type::TIMESTAMPTZ),
            ],
        )?;

        if let Some(row) = row {
            Ok(SecretAccessGrant {
                tenant_id: TenantId::from_uuid(row.get("tenant_id")),
                actor_id: ActorId::from_uuid(row.get("actor_id")),
                secret_name: row.get("secret_name"),
                vault_path: row.get("vault_path"),
                required_capability: Capability::parse(
                    row.get::<_, String>("required_capability").as_str(),
                )?,
                session_expires_at: row.get("expires_at"),
            })
        } else {
            Err(AuthError::SecretAccessDenied {
                secret_name: secret_name.to_owned(),
            })
        }
    }
}

#[derive(Clone, Copy)]
enum ApplicationRole {
    Bff,
    Execution,
}

fn require_narrow_login(client: &mut Client, expected: ApplicationRole) -> Result<(), AuthError> {
    let row = client.query_one(
        "select r.rolsuper, r.rolbypassrls, r.rolcreaterole,
                r.rolcreatedb, r.rolreplication,
                pg_has_role(session_user, 'service_role', 'MEMBER') as service_member,
                pg_has_role(session_user, 'pg_read_all_data', 'MEMBER') as read_all,
                pg_has_role(session_user, 'pg_write_all_data', 'MEMBER') as write_all,
                pg_has_role(session_user, 'quantos_bff', 'SET') as can_set_bff,
                pg_has_role(session_user, 'quantos_execution_gateway', 'SET') as can_set_execution,
                case when to_regclass('vault.decrypted_secrets') is null then true
                     else exists (
                       select 1 from pg_roles as reachable
                       where pg_has_role(session_user::regrole::oid, reachable.oid, 'SET')
                         and has_table_privilege(reachable.oid, 'vault.decrypted_secrets', 'SELECT')
                     )
                end as vault_reader
         from pg_roles as r where r.rolname = session_user",
        &[],
    )?;
    if row.get::<_, bool>("rolsuper")
        || row.get::<_, bool>("rolbypassrls")
        || row.get::<_, bool>("rolcreaterole")
        || row.get::<_, bool>("rolcreatedb")
        || row.get::<_, bool>("rolreplication")
        || row.get::<_, bool>("service_member")
        || row.get::<_, bool>("read_all")
        || row.get::<_, bool>("write_all")
        || row.get::<_, bool>("vault_reader")
        || match expected {
            ApplicationRole::Bff => {
                !row.get::<_, bool>("can_set_bff") || row.get::<_, bool>("can_set_execution")
            }
            ApplicationRole::Execution => {
                !row.get::<_, bool>("can_set_execution") || row.get::<_, bool>("can_set_bff")
            }
        }
    {
        return Err(AuthError::UnsafeApplicationLogin);
    }
    Ok(())
}

pub struct GatewayAuthMiddleware {
    store: PgAuthStore,
}

impl GatewayAuthMiddleware {
    pub fn connect(database_url: &str) -> Result<Self, AuthError> {
        Ok(Self {
            store: PgAuthStore::connect(database_url)?,
        })
    }

    pub fn connect_as_bff(database_url: &str) -> Result<Self, AuthError> {
        Ok(Self {
            store: PgAuthStore::connect_as_bff(database_url)?,
        })
    }

    pub fn authorize_user_request(
        &mut self,
        request: &UserRequestContext,
        requirement: &AuthorizationRequirement,
    ) -> Result<AuthContext, AuthError> {
        let context = self.store.load_user_context(
            request.user_id,
            request.tenant_id,
            request.mode,
            request.account_id,
        )?;
        PolicyEngine::authorize_action(&context.policy_context(), requirement)?;
        Ok(context)
    }

    pub fn authorize_access_token(
        &mut self,
        verifier: &SupabaseAuthVerifier,
        access_token: &str,
        account_id: Option<AccountId>,
        requirement: &AuthorizationRequirement,
    ) -> Result<AuthContext, AuthError> {
        let context = self.load_access_token_context(verifier, access_token, account_id)?;
        PolicyEngine::authorize_action(&context.policy_context(), requirement)?;
        Ok(context)
    }

    pub fn load_access_token_context(
        &mut self,
        verifier: &SupabaseAuthVerifier,
        access_token: &str,
        account_id: Option<AccountId>,
    ) -> Result<AuthContext, AuthError> {
        let user = verifier.verify_access_token(access_token)?;
        self.store.load_primary_context(user.id, account_id)
    }

    pub fn authorize_secret_resolution(
        &mut self,
        session_token_hash: &str,
        secret_name: &str,
        now: DateTime<Utc>,
    ) -> Result<SecretAccessGrant, AuthError> {
        let grant = self
            .store
            .load_service_secret_grant(session_token_hash, secret_name, now)?;
        let mut capabilities = BTreeSet::new();
        capabilities.insert(Capability::parse(Capability::SECRET_RESOLVE)?);
        capabilities.insert(grant.required_capability.clone());

        let service_context = PolicyContext {
            tenant_id: grant.tenant_id,
            actor_id: grant.actor_id,
            workspace_id: WorkspaceId::from_uuid(Uuid::nil()),
            account_id: None,
            role: Role::Service,
            mode: RunMode::Paper,
            capabilities,
        };

        PolicyEngine::authorize_secret_resolution(
            &service_context,
            &SecretAccessRequest {
                required_capability: grant.required_capability.clone(),
                service_session_active: grant.session_expires_at > now,
            },
        )?;

        Ok(grant)
    }

    pub fn issue_bff_session(
        &mut self,
        verifier: &SupabaseAuthVerifier,
        access_token: &str,
    ) -> Result<String, AuthError> {
        let user = verifier.verify_access_token(access_token)?;
        self.store.issue_bff_session(&user)
    }

    pub fn load_bff_session_context(
        &mut self,
        raw_session: &str,
        account_id: Option<AccountId>,
    ) -> Result<BffSessionContext, AuthError> {
        self.store.load_bff_session_context(raw_session, account_id)
    }

    pub fn revoke_bff_session(&mut self, raw_session: &str) -> Result<(), AuthError> {
        self.store.revoke_bff_session(raw_session)
    }
}

fn session_hash(raw: &str) -> String {
    format!("{:x}", Sha256::digest(raw.as_bytes()))
}

fn connect_client(database_url: &str) -> Result<Client, AuthError> {
    let url = Url::parse(database_url)?;
    let disable_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && value == "disable");
    let relaxed_tls = url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && (value == "require" || value == "prefer"));
    if disable_tls {
        if !matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1")) {
            return Err(AuthError::InsecureDatabaseTransport);
        }
        Ok(Client::connect(database_url, NoTls)?)
    } else {
        let mut builder = TlsConnector::builder();
        if let Some(root_path) = url
            .query_pairs()
            .find(|(key, _)| key == "sslrootcert")
            .map(|(_, value)| value.into_owned())
        {
            let root = native_tls::Certificate::from_pem(&std::fs::read(root_path)?)?;
            builder.add_root_certificate(root);
        }
        if relaxed_tls {
            builder.danger_accept_invalid_certs(true);
        }
        let connector = builder.build()?;
        Ok(Client::connect(
            database_url,
            MakeTlsConnector::new(connector),
        )?)
    }
}

fn require_verified_transport(database_url: &str) -> Result<(), AuthError> {
    let url = Url::parse(database_url)?;
    if !url
        .query_pairs()
        .any(|(key, value)| key == "sslmode" && value == "verify-full")
    {
        return Err(AuthError::InsecureDatabaseTransport);
    }
    Ok(())
}

fn row_to_auth_context(
    row: Row,
    tenant_id: TenantId,
    mode: RunMode,
    account_id: Option<AccountId>,
) -> Result<AuthContext, AuthError> {
    let role = Role::parse(row.get::<_, String>("role").as_str())?;
    let mut capabilities = BTreeSet::new();
    for capability in row
        .get::<_, Vec<Option<String>>>("capabilities")
        .into_iter()
        .flatten()
    {
        capabilities.insert(Capability::parse(capability.as_str())?);
    }

    Ok(AuthContext {
        tenant_id,
        actor_id: ActorId::from_uuid(row.get("actor_id")),
        user_id: row.get("user_id"),
        workspace_id: WorkspaceId::from_uuid(row.get("workspace_id")),
        workspace_slug: row.get("workspace_slug"),
        workspace_name: row.get("workspace_name"),
        role,
        mode,
        account_id,
        capabilities,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        AuthContext, UserRequestContext, require_verified_transport, verified_user_claims,
    };
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
    use chrono::{Duration, Utc};
    use quantos_core::{AccountId, ActorId, TenantId, WorkspaceId};
    use quantos_policy::{Capability, Role, RunMode};
    use std::collections::BTreeSet;
    use uuid::Uuid;

    #[test]
    fn verified_claims_bind_subject_role_mfa_and_expiry() {
        let id = Uuid::now_v7();
        let payload = serde_json::json!({
            "sub": id.to_string(), "role": "authenticated", "aal": "aal2",
            "exp": (Utc::now() + Duration::minutes(2)).timestamp(),
        });
        let token = format!(
            "header.{}.signature",
            URL_SAFE_NO_PAD.encode(payload.to_string())
        );
        assert!(verified_user_claims(&token, id).unwrap().mfa_verified);
        assert!(verified_user_claims(&token, Uuid::now_v7()).is_err());
        let service = payload.as_object().unwrap().clone();
        let mut service = serde_json::Value::Object(service);
        service["role"] = serde_json::json!("service_role");
        let service_token = format!(
            "header.{}.signature",
            URL_SAFE_NO_PAD.encode(service.to_string())
        );
        assert!(verified_user_claims(&service_token, id).is_err());
        let expired = serde_json::json!({
            "sub": id.to_string(), "role": "authenticated", "aal": "aal2",
            "exp": (Utc::now() - Duration::seconds(1)).timestamp(),
        });
        let expired_token = format!(
            "header.{}.signature",
            URL_SAFE_NO_PAD.encode(expired.to_string())
        );
        assert!(verified_user_claims(&expired_token, id).is_err());
    }

    #[test]
    fn application_urls_require_certificate_verification() {
        assert!(
            require_verified_transport("postgres://user@db.example/postgres?sslmode=require")
                .is_err()
        );
        assert!(
            require_verified_transport("postgres://user@db.example/postgres?sslmode=disable")
                .is_err()
        );
        assert!(
            require_verified_transport("postgres://user@db.example/postgres?sslmode=verify-full")
                .is_ok()
        );
    }

    #[test]
    fn auth_context_projects_policy_context() {
        let context = AuthContext {
            tenant_id: TenantId::new(),
            actor_id: ActorId::new(),
            user_id: Uuid::now_v7(),
            workspace_id: WorkspaceId::new(),
            workspace_slug: "primary".to_owned(),
            workspace_name: "Primary".to_owned(),
            role: Role::Operator,
            mode: RunMode::Paper,
            account_id: Some(AccountId::new()),
            capabilities: BTreeSet::from([
                Capability::parse(Capability::ACCOUNT_READ).expect("static capability parses")
            ]),
        };

        let policy = context.policy_context();
        assert_eq!(policy.actor_id, context.actor_id);
        assert_eq!(policy.workspace_id, context.workspace_id);
        assert!(policy.account_id.is_some());
    }

    #[test]
    fn user_request_context_can_represent_primary_workspace_session() {
        let request = UserRequestContext {
            user_id: Uuid::now_v7(),
            tenant_id: TenantId::new(),
            mode: RunMode::Shadow,
            account_id: Some(AccountId::new()),
        };

        assert_eq!(request.mode, RunMode::Shadow);
        assert!(request.account_id.is_some());
    }
}
