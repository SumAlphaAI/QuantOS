use std::collections::BTreeSet;

use quantos_core::{AccountId, ActorId, TenantId, WorkspaceId};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Owner,
    Approver,
    Operator,
    Viewer,
    Service,
}

impl Role {
    pub fn parse(value: &str) -> Result<Self, PolicyError> {
        match value {
            "owner" => Ok(Self::Owner),
            "approver" => Ok(Self::Approver),
            "operator" => Ok(Self::Operator),
            "viewer" => Ok(Self::Viewer),
            "service" => Ok(Self::Service),
            _ => Err(PolicyError::invalid_role(value)),
        }
    }

    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Owner => "owner",
            Self::Approver => "approver",
            Self::Operator => "operator",
            Self::Viewer => "viewer",
            Self::Service => "service",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunMode {
    Paper,
    Shadow,
    AssistedLive,
}

impl RunMode {
    pub fn parse(value: &str) -> Result<Self, PolicyError> {
        match value {
            "paper" => Ok(Self::Paper),
            "shadow" => Ok(Self::Shadow),
            "assisted_live" => Ok(Self::AssistedLive),
            _ => Err(PolicyError::invalid_mode(value)),
        }
    }

    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Paper => "paper",
            Self::Shadow => "shadow",
            Self::AssistedLive => "assisted_live",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Capability(String);

impl Capability {
    pub const RESEARCH_READ: &'static str = "research.read";
    pub const RESEARCH_WRITE: &'static str = "research.write";
    pub const STRATEGY_APPROVE: &'static str = "strategy.approve";
    pub const STRATEGY_WRITE: &'static str = "strategy.write";
    pub const EXECUTION_OPERATE: &'static str = "execution.operate";
    pub const ACCOUNT_READ: &'static str = "account.read";
    pub const SECRET_RESOLVE: &'static str = "secret.resolve";

    pub fn parse(value: &str) -> Result<Self, PolicyError> {
        let normalized = value.trim().to_ascii_lowercase();
        if normalized.is_empty() {
            return Err(PolicyError::invalid_capability(value));
        }
        Ok(Self(normalized))
    }

    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PolicyContext {
    pub tenant_id: TenantId,
    pub actor_id: ActorId,
    pub workspace_id: WorkspaceId,
    pub account_id: Option<AccountId>,
    pub role: Role,
    pub mode: RunMode,
    pub capabilities: BTreeSet<Capability>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorizationRequirement {
    pub capability: Capability,
    pub account_required: bool,
    pub allowed_modes: Option<BTreeSet<RunMode>>,
}

impl AuthorizationRequirement {
    pub fn new(capability: Capability) -> Self {
        Self {
            capability,
            account_required: false,
            allowed_modes: None,
        }
    }

    #[must_use]
    pub fn requiring_account(mut self) -> Self {
        self.account_required = true;
        self
    }

    #[must_use]
    pub fn allowing_modes(mut self, modes: impl IntoIterator<Item = RunMode>) -> Self {
        self.allowed_modes = Some(modes.into_iter().collect());
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SecretAccessRequest {
    pub required_capability: Capability,
    pub service_session_active: bool,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
#[error("{code}: {message}")]
pub struct PolicyError {
    code: &'static str,
    message: String,
}

impl PolicyError {
    #[must_use]
    pub fn machine_code(&self) -> &'static str {
        self.code
    }

    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    fn invalid_role(value: &str) -> Self {
        Self::new("POLICY_INVALID_ROLE", format!("invalid role `{value}`"))
    }

    fn invalid_mode(value: &str) -> Self {
        Self::new("POLICY_INVALID_MODE", format!("invalid mode `{value}`"))
    }

    fn invalid_capability(value: &str) -> Self {
        Self::new(
            "POLICY_INVALID_CAPABILITY",
            format!("invalid capability `{value}`"),
        )
    }

    #[must_use]
    pub fn capability_denied(capability: &Capability) -> Self {
        Self::new(
            "POLICY_CAPABILITY_DENIED",
            format!("capability `{}` is not granted", capability.as_str()),
        )
    }

    #[must_use]
    pub fn account_required() -> Self {
        Self::new(
            "POLICY_ACCOUNT_REQUIRED",
            "account context is required for this authorization decision",
        )
    }

    #[must_use]
    pub fn mode_denied(mode: RunMode) -> Self {
        Self::new(
            "POLICY_MODE_DENIED",
            format!(
                "mode `{}` is not allowed for this authorization decision",
                mode.as_str()
            ),
        )
    }

    #[must_use]
    pub fn secret_access_denied() -> Self {
        Self::new(
            "POLICY_SECRET_ACCESS_DENIED",
            "secret resolution is restricted to service sessions with explicit allowlist grants",
        )
    }
}

pub struct PolicyEngine;

impl PolicyEngine {
    pub fn authorize_action(
        context: &PolicyContext,
        requirement: &AuthorizationRequirement,
    ) -> Result<(), PolicyError> {
        if requirement.account_required && context.account_id.is_none() {
            return Err(PolicyError::account_required());
        }

        if let Some(modes) = &requirement.allowed_modes
            && !modes.contains(&context.mode)
        {
            return Err(PolicyError::mode_denied(context.mode));
        }

        if Self::role_implies_capability(context.role, &requirement.capability)
            || context.capabilities.contains(&requirement.capability)
        {
            Ok(())
        } else {
            Err(PolicyError::capability_denied(&requirement.capability))
        }
    }

    pub fn authorize_secret_resolution(
        context: &PolicyContext,
        request: &SecretAccessRequest,
    ) -> Result<(), PolicyError> {
        if context.role != Role::Service || !request.service_session_active {
            return Err(PolicyError::secret_access_denied());
        }

        let resolve =
            Capability::parse(Capability::SECRET_RESOLVE).expect("static capability must parse");
        if !context.capabilities.contains(&resolve)
            || !context.capabilities.contains(&request.required_capability)
        {
            return Err(PolicyError::secret_access_denied());
        }

        Ok(())
    }

    fn role_implies_capability(role: Role, capability: &Capability) -> bool {
        match role {
            Role::Owner => matches!(
                capability.as_str(),
                Capability::RESEARCH_READ
                    | Capability::RESEARCH_WRITE
                    | Capability::STRATEGY_APPROVE
                    | Capability::STRATEGY_WRITE
                    | Capability::EXECUTION_OPERATE
                    | Capability::ACCOUNT_READ
            ),
            Role::Approver => matches!(
                capability.as_str(),
                Capability::RESEARCH_READ | Capability::STRATEGY_APPROVE | Capability::ACCOUNT_READ
            ),
            Role::Operator => matches!(
                capability.as_str(),
                Capability::RESEARCH_READ
                    | Capability::EXECUTION_OPERATE
                    | Capability::ACCOUNT_READ
            ),
            Role::Viewer => matches!(capability.as_str(), Capability::RESEARCH_READ),
            Role::Service => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        AuthorizationRequirement, Capability, PolicyContext, PolicyEngine, Role, RunMode,
        SecretAccessRequest,
    };
    use quantos_core::{AccountId, ActorId, TenantId, WorkspaceId};
    use std::collections::BTreeSet;

    fn base_context(role: Role) -> PolicyContext {
        PolicyContext {
            tenant_id: TenantId::new(),
            actor_id: ActorId::new(),
            workspace_id: WorkspaceId::new(),
            account_id: Some(AccountId::new()),
            role,
            mode: RunMode::Paper,
            capabilities: BTreeSet::new(),
        }
    }

    #[test]
    fn owner_role_is_allowed_without_explicit_capability_row() {
        let context = base_context(Role::Owner);
        let requirement = AuthorizationRequirement::new(
            Capability::parse(Capability::EXECUTION_OPERATE).expect("static capability parses"),
        )
        .requiring_account();

        PolicyEngine::authorize_action(&context, &requirement).expect("owner should pass");
    }

    #[test]
    fn viewer_role_cannot_execute_without_explicit_capability() {
        let context = base_context(Role::Viewer);
        let requirement = AuthorizationRequirement::new(
            Capability::parse(Capability::EXECUTION_OPERATE).expect("static capability parses"),
        );

        let error = PolicyEngine::authorize_action(&context, &requirement)
            .expect_err("viewer should be denied");
        assert_eq!(error.machine_code(), "POLICY_CAPABILITY_DENIED");
    }

    #[test]
    fn explicit_capability_can_unlock_service_secret_resolution() {
        let mut context = base_context(Role::Service);
        context.account_id = None;
        context.capabilities.insert(
            Capability::parse(Capability::SECRET_RESOLVE).expect("static capability parses"),
        );
        context.capabilities.insert(
            Capability::parse(Capability::EXECUTION_OPERATE).expect("static capability parses"),
        );

        let request = SecretAccessRequest {
            required_capability: Capability::parse(Capability::EXECUTION_OPERATE)
                .expect("static capability parses"),
            service_session_active: true,
        };

        PolicyEngine::authorize_secret_resolution(&context, &request)
            .expect("service secret access should pass");
    }

    #[test]
    fn secret_resolution_rejects_non_service_roles() {
        let mut context = base_context(Role::Operator);
        context.capabilities.insert(
            Capability::parse(Capability::SECRET_RESOLVE).expect("static capability parses"),
        );

        let request = SecretAccessRequest {
            required_capability: Capability::parse(Capability::EXECUTION_OPERATE)
                .expect("static capability parses"),
            service_session_active: true,
        };

        let error = PolicyEngine::authorize_secret_resolution(&context, &request)
            .expect_err("user roles must not resolve secrets");
        assert_eq!(error.machine_code(), "POLICY_SECRET_ACCESS_DENIED");
    }

    #[test]
    fn owner_does_not_inherit_secret_resolution_or_unknown_capabilities() {
        let context = base_context(Role::Owner);
        for name in [Capability::SECRET_RESOLVE, "unreviewed.capability"] {
            let requirement = AuthorizationRequirement::new(Capability::parse(name).unwrap());
            assert_eq!(
                PolicyEngine::authorize_action(&context, &requirement)
                    .unwrap_err()
                    .machine_code(),
                "POLICY_CAPABILITY_DENIED"
            );
        }
    }
}
