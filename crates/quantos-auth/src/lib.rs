use std::collections::BTreeSet;

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
    Policy(#[from] PolicyError),
    #[error("identity mapping is missing for user `{user_id}` in tenant `{tenant_id}`")]
    MissingIdentityMapping { user_id: Uuid, tenant_id: TenantId },
    #[error(
        "secret allowlist entry `{secret_name}` is unavailable for the provided service session"
    )]
    SecretAccessDenied { secret_name: String },
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
             join quantos.workspace_memberships as wm on wm.actor_id = a.id
             join quantos.workspaces as w on w.id = wm.workspace_id and w.is_primary = true
             left join quantos.actor_capabilities as ac
               on ac.actor_id = a.id
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
              and actor.actor_kind = 'service'
              and actor.is_active = true
             join quantos.secret_references as secret
               on secret.tenant_id = session.tenant_id
              and secret.secret_name = $2
              and secret.rotation_state = 'active'
             where session.session_token_hash = $1
               and session.revoked_at is null
               and session.expires_at > $3
               and session.allowed_capability = secret.required_capability
               and exists (
                 select 1
                 from quantos.actor_capabilities as capability
                 where capability.actor_id = session.actor_id
                   and capability.capability = secret.required_capability
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

pub struct GatewayAuthMiddleware {
    store: PgAuthStore,
}

impl GatewayAuthMiddleware {
    pub fn connect(database_url: &str) -> Result<Self, AuthError> {
        Ok(Self {
            store: PgAuthStore::connect(database_url)?,
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
        Ok(Client::connect(database_url, NoTls)?)
    } else {
        let mut builder = TlsConnector::builder();
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
    use super::{AuthContext, UserRequestContext};
    use quantos_core::{AccountId, ActorId, TenantId, WorkspaceId};
    use quantos_policy::{Capability, Role, RunMode};
    use std::collections::BTreeSet;
    use uuid::Uuid;

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
