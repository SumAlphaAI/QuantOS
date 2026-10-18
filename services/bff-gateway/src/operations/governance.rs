//! Scope-bound governance lease. Grants never exceed the original F06 identity.
//! Tombstones and versions prevent ABA; no arbitrary policy expressions or flags.
use super::*;
use quantos_policy::{Capability, Role};
use serde::{Deserialize, Serialize};
pub(super) const CAPS: &[&str] = &[
    "ops.read",
    "ops.operate",
    "ops.approve",
    "admin.read",
    "admin.write",
    "alerts.read",
];
pub(super) const FLAGS: &[&str] = &[
    "alerts-live-view",
    "incident-timeline",
    "admin-catalog-preview",
    "ops-notices",
];
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Spec {
    Member {
        actor_id: Uuid,
        role_id: Uuid,
        active: bool,
    },
    Role {
        name: String,
        base_role: Role,
        permissions: Vec<String>,
    },
    Policy {
        name: String,
        role_id: Uuid,
        denied_capabilities: Vec<String>,
        active: bool,
    },
    Capability {
        name: String,
        enabled: bool,
    },
    EngineCapability {
        review_id: Uuid,
        name: String,
        version: String,
        description: String,
        enabled: bool,
    },
    Flag {
        name: String,
        enabled: bool,
        rollout_percent: u8,
    },
}
impl Spec {
    pub(super) fn kind(&self) -> &'static str {
        match self {
            Self::Member { .. } => "members",
            Self::Role { .. } => "roles",
            Self::Policy { .. } => "policies",
            Self::Capability { .. } | Self::EngineCapability { .. } => "capabilities",
            Self::Flag { .. } => "feature-flags",
        }
    }
}
pub(super) fn id(s: &str) -> Uuid {
    let h = digest(&json!(s));
    let mut b = [0; 16];
    for (i, n) in b.iter_mut().enumerate() {
        *n = u8::from_str_radix(&h[7 + i * 2..9 + i * 2], 16).unwrap()
    }
    b[6] = (b[6] & 15) | 64;
    b[8] = (b[8] & 63) | 128;
    Uuid::from_bytes(b)
}
fn role_id(role: Role) -> Uuid {
    id(&format!("c11-role:{}", role.as_str()))
}
fn allowed(role: Role) -> Vec<String> {
    match role {
        Role::Owner => vec![
            "ops.read",
            "ops.operate",
            "admin.read",
            "admin.write",
            "alerts.read",
        ],
        Role::Operator => vec!["ops.read", "ops.operate", "alerts.read"],
        Role::Approver => vec!["ops.read", "ops.approve", "alerts.read"],
        Role::Viewer => vec!["ops.read", "alerts.read"],
        Role::Service => vec!["ops.read"],
    }
    .into_iter()
    .map(str::to_owned)
    .collect()
}
#[derive(Clone)]
pub(super) struct Entry {
    pub id: Uuid,
    pub spec: Spec,
    pub version: u64,
    pub deleted: bool,
    pub protected: bool,
}
impl Entry {
    pub fn page(&self, config: u64) -> Value {
        json!({"id":self.id,"kind":self.spec.kind(),"objectVersion":self.version.to_string(),"configVersion":config.to_string(),"deleted":self.deleted,"protected":self.protected,"spec":self.spec})
    }
}
#[derive(Clone)]
pub(super) struct EngineReview {
    pub id: Uuid,
    pub reviewer: Uuid,
    pub expires: DateTime<Utc>,
    pub capabilities: Vec<quantos_engine_manager::EngineCapabilityManifest>,
}
#[derive(Clone)]
pub(super) struct Governance {
    pub scope: quantos_operations::Scope,
    pub registry: BTreeMap<Uuid, AuthContext>,
    pub entries: BTreeMap<Uuid, Entry>,
    pub version: u64,
    pub reviews: BTreeMap<Uuid, EngineReview>,
}
impl Governance {
    pub fn new(scope: quantos_operations::Scope, registry: Vec<AuthContext>) -> Result<Self> {
        let mut g = Self {
            scope,
            registry: BTreeMap::new(),
            entries: BTreeMap::new(),
            version: 0,
            reviews: BTreeMap::new(),
        };
        for role in [
            Role::Owner,
            Role::Operator,
            Role::Approver,
            Role::Viewer,
            Role::Service,
        ] {
            let rid = role_id(role);
            g.entries.insert(
                rid,
                Entry {
                    id: rid,
                    spec: Spec::Role {
                        name: role.as_str().into(),
                        base_role: role,
                        permissions: allowed(role),
                    },
                    version: 0,
                    deleted: false,
                    protected: true,
                },
            );
        }
        for cap in CAPS.iter().filter(|c| **c != "ops.approve") {
            let rid = id(&format!("c11-capability:{cap}"));
            g.entries.insert(
                rid,
                Entry {
                    id: rid,
                    spec: Spec::Capability {
                        name: (*cap).into(),
                        enabled: true,
                    },
                    version: 0,
                    deleted: false,
                    protected: *cap == "admin.write",
                },
            );
        }
        for name in &FLAGS[..3] {
            let rid = id(&format!("c11-flag:{name}"));
            g.entries.insert(
                rid,
                Entry {
                    id: rid,
                    spec: Spec::Flag {
                        name: (*name).into(),
                        enabled: true,
                        rollout_percent: 100,
                    },
                    version: 0,
                    deleted: false,
                    protected: false,
                },
            );
        }
        for a in registry {
            if a.tenant_id != g.scope.tenant_id
                || a.workspace_id != g.scope.workspace_id
                || a.account_id != Some(g.scope.account_id)
                || a.mode != g.scope.mode
                || a.user_id.is_nil()
                || a.actor_id.as_uuid().is_nil()
                || g.registry.insert(*a.actor_id.as_uuid(), a).is_some()
            {
                return Err(Fault::invalid());
            }
        }
        for (&actor, a) in &g.registry {
            g.entries.insert(
                actor,
                Entry {
                    id: actor,
                    spec: Spec::Member {
                        actor_id: actor,
                        role_id: role_id(a.role),
                        active: true,
                    },
                    version: 0,
                    deleted: false,
                    protected: false,
                },
            );
        }
        if g.owner_users().is_empty() {
            return Err(Fault::invalid());
        }
        Ok(g)
    }
    fn member(&self, actor: Uuid) -> Option<(&Entry, &Entry)> {
        let e = self.entries.get(&actor)?;
        if e.deleted {
            return None;
        }
        let Spec::Member {
            role_id,
            active: true,
            ..
        } = &e.spec
        else {
            return None;
        };
        let role = self.entries.get(role_id)?;
        if role.deleted {
            return None;
        }
        Some((e, role))
    }
    pub fn context_current(&self, a: &AuthContext) -> bool {
        a.tenant_id == self.scope.tenant_id
            && a.workspace_id == self.scope.workspace_id
            && a.account_id == Some(self.scope.account_id)
            && a.mode == self.scope.mode
            && self
                .registry
                .get(a.actor_id.as_uuid())
                .is_some_and(|known| known.user_id == a.user_id)
            && self.member(*a.actor_id.as_uuid()).is_some_and(
                |(_, r)| matches!(&r.spec,Spec::Role{base_role,..} if *base_role==a.role),
            )
    }
    pub fn allows(&self, a: &AuthContext, cap: &str) -> bool {
        if !self.context_current(a) || !a.capabilities.iter().any(|c| c.as_str() == cap) {
            return false;
        }
        let (_, role) = self.member(*a.actor_id.as_uuid()).unwrap();
        let Spec::Role { permissions, .. } = &role.spec else {
            return false;
        };
        permissions.iter().any(|c|c==cap)&&self.entries.values().any(|e|!e.deleted&&matches!(&e.spec,Spec::Capability{name,enabled:true} if name==cap))&&!self.entries.values().any(|e|!e.deleted&&matches!(&e.spec,Spec::Policy{role_id,denied_capabilities,active:true,..} if *role_id==role.id&&denied_capabilities.iter().any(|c|c==cap)))
    }
    fn owner_users(&self) -> std::collections::BTreeSet<Uuid> {
        self.registry
            .values()
            .filter(|a| a.role == Role::Owner && self.allows(a, "admin.write"))
            .map(|a| a.user_id)
            .collect()
    }
    pub fn flag(&self, name: &str, actor: Uuid) -> bool {
        self.entries.values().any(|e|!e.deleted&&matches!(&e.spec,Spec::Flag{name:n,enabled:true,rollout_percent} if n==name&&u16::from(actor.as_bytes()[0])*100/256<u16::from(*rollout_percent)))
    }
    #[allow(clippy::too_many_arguments)]
    pub fn mutate(
        &mut self,
        a: &AuthContext,
        kind: &str,
        target: Option<Uuid>,
        spec: Option<Spec>,
        version: &str,
        delete: bool,
        now: DateTime<Utc>,
    ) -> Result<Value> {
        if a.role != Role::Owner || !self.allows(a, "admin.write") {
            return Err(fault(403, "FORBIDDEN"));
        }
        let mut next = self.clone();
        let old = target.and_then(|id| next.entries.get(&id)).cloned();
        let current = if target.is_none() {
            self.version
        } else {
            old.as_ref()
                .filter(|e| e.spec.kind() == kind)
                .ok_or_else(Fault::hidden)?
                .version
        };
        if version != current.to_string() {
            return Err(fault(409, "VERSION_CONFLICT"));
        }
        if old.as_ref().is_some_and(|e| e.protected) {
            return Err(fault(403, "PROTECTED_RESOURCE"));
        }
        let input = if delete {
            old.as_ref().unwrap().spec.clone()
        } else {
            spec.ok_or_else(Fault::invalid)?
        };
        if input.kind() != kind {
            return Err(Fault::invalid());
        }
        let rid = match &input {
            Spec::Member {
                actor_id, role_id, ..
            } => {
                if !next.registry.contains_key(actor_id)
                    || !next
                        .entries
                        .get(role_id)
                        .is_some_and(|e| !e.deleted && matches!(e.spec, Spec::Role { .. }))
                {
                    return Err(Fault::invalid());
                }
                *actor_id
            }
            _ => target.unwrap_or_else(Uuid::new_v4),
        };
        if target.is_some_and(|t| t != rid) || target.is_none() && next.entries.contains_key(&rid) {
            return Err(fault(409, "RESOURCE_EXISTS"));
        }
        match &input {
            Spec::Role {
                name,
                base_role,
                permissions,
            } => {
                if !name_ok(name)
                    || matches!(base_role, Role::Owner | Role::Service)
                    || permissions.iter().any(|c| !allowed(*base_role).contains(c))
                    || unique(permissions) != permissions.len()
                {
                    return Err(Fault::invalid());
                }
            }
            Spec::Policy {
                name,
                role_id,
                denied_capabilities,
                ..
            } => {
                if !name_ok(name)
                    || denied_capabilities
                        .iter()
                        .any(|c| !CAPS.contains(&c.as_str()))
                    || unique(denied_capabilities) != denied_capabilities.len()
                    || !next
                        .entries
                        .get(role_id)
                        .is_some_and(|e| !e.deleted && matches!(e.spec, Spec::Role { .. }))
                {
                    return Err(Fault::invalid());
                }
            }
            Spec::EngineCapability {
                review_id,
                name,
                version,
                description,
                enabled,
            } => {
                let r = self
                    .reviews
                    .get(review_id)
                    .ok_or_else(|| fault(403, "ENGINE_REVIEW_REQUIRED"))?;
                if !delete && r.expires <= now {
                    return Err(fault(409, "ENGINE_REVIEW_EXPIRED"));
                }
                if !r.capabilities.iter().any(|c| {
                    &c.name == name && &c.version == version && &c.description == description
                }) {
                    return Err(fault(403, "ENGINE_REVIEW_MISMATCH"));
                }
                if !delete && *enabled && r.reviewer == a.user_id {
                    return Err(fault(403, "SELF_APPROVAL"));
                }
            }
            Spec::Capability { name, .. } => {
                if !CAPS.contains(&name.as_str()) {
                    return Err(Fault::invalid());
                }
            }
            Spec::Flag {
                name,
                rollout_percent,
                ..
            } => {
                if !FLAGS.contains(&name.as_str()) || *rollout_percent > 100 {
                    return Err(Fault::invalid());
                }
            }
            _ => {}
        }
        let label = |s: &Spec| -> Option<String> {
            match s {
                Spec::Member { .. } => None,
                Spec::Role { name, .. }
                | Spec::Policy { name, .. }
                | Spec::Capability { name, .. }
                | Spec::Flag { name, .. }
                | Spec::EngineCapability { name, .. } => Some(name.clone()),
            }
        };
        if let Some(name) = label(&input)
            && next.entries.values().any(|e| {
                e.id != rid && e.spec.kind() == kind && label(&e.spec).as_deref() == Some(&name)
            })
        {
            return Err(fault(409, "RESOURCE_EXISTS"));
        }
        if delete&&next.entries.values().any(|e|!e.deleted&&e.id!=rid&&matches!(&e.spec,Spec::Member{role_id,..}|Spec::Policy{role_id,..} if *role_id==rid)){return Err(fault(409,"RESOURCE_IN_USE"))}
        let entry = Entry {
            id: rid,
            spec: input,
            version: old.as_ref().map_or(0, |e| e.version + 1),
            deleted: delete,
            protected: false,
        };
        next.entries.insert(rid, entry.clone());
        if next.owner_users().is_empty() {
            return Err(fault(409, "LAST_ADMIN"));
        }
        if rid == *a.actor_id.as_uuid()
            || matches!(&entry.spec,Spec::Member{actor_id,..} if self.registry.get(actor_id).is_some_and(|other|other.user_id==a.user_id))
        {
            return Err(fault(403, "SELF_GOVERNANCE"));
        }
        if next.entries.len() > 1000 {
            return Err(fault(429, "LEASE_CAPACITY"));
        }
        next.version += 1;
        let page = entry.page(next.version);
        *self = next;
        Ok(page)
    }
}
fn unique(v: &[String]) -> usize {
    v.iter().collect::<std::collections::BTreeSet<_>>().len()
}
fn name_ok(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 64
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
}
pub(super) fn reference_auth(session: &str, shadow: bool) -> AuthContext {
    let mut a = crate::strategy::reference_auth(session);
    if !matches!(
        session,
        crate::CURRENT_SESSION | "session-owner" | "session-approver"
    ) {
        a.actor_id = quantos_core::ActorId::from_uuid(id("c11-viewer"));
    }
    a.user_id = id(&format!("c11-user:{}", a.actor_id));
    if shadow {
        a.mode = quantos_policy::RunMode::Shadow;
    }
    for c in allowed(a.role) {
        if a.role != Role::Viewer {
            a.capabilities.insert(Capability::parse(&c).unwrap());
        }
    }
    if matches!(a.role, Role::Owner | Role::Operator | Role::Approver) {
        a.capabilities
            .insert(Capability::parse("audit.read").unwrap());
    }
    a
}
