begin;

create table if not exists quantos.workspaces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  slug text not null,
  name text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create unique index if not exists idx_workspaces_single_primary
  on quantos.workspaces (tenant_id)
  where is_primary;

create table if not exists quantos.actors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  actor_kind text not null check (actor_kind in ('user', 'service')),
  display_name text not null,
  service_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (tenant_id, user_id),
  unique nulls not distinct (tenant_id, service_name)
);

create table if not exists quantos.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  workspace_id uuid not null references quantos.workspaces(id) on delete cascade,
  actor_id uuid not null references quantos.actors(id) on delete cascade,
  role text not null check (role in ('owner', 'approver', 'operator', 'viewer', 'service')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, actor_id)
);

create table if not exists quantos.accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  workspace_id uuid not null references quantos.workspaces(id) on delete cascade,
  venue text not null,
  external_account_ref text not null,
  name text not null,
  mode text not null check (mode in ('paper', 'shadow', 'assisted_live')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_account_ref)
);

create table if not exists quantos.actor_capabilities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  actor_id uuid not null references quantos.actors(id) on delete cascade,
  workspace_id uuid references quantos.workspaces(id) on delete cascade,
  account_id uuid references quantos.accounts(id) on delete cascade,
  capability text not null,
  mode_scope text check (mode_scope in ('paper', 'shadow', 'assisted_live')),
  created_at timestamptz not null default now()
);

create index if not exists idx_actor_capabilities_lookup
  on quantos.actor_capabilities (actor_id, capability, mode_scope);

create table if not exists quantos.secret_references (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  workspace_id uuid references quantos.workspaces(id) on delete cascade,
  account_id uuid references quantos.accounts(id) on delete cascade,
  secret_name text not null,
  vault_path text not null,
  required_capability text not null,
  rotation_state text not null check (rotation_state in ('active', 'rotating', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, secret_name)
);

create table if not exists quantos.execution_service_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  actor_id uuid not null references quantos.actors(id) on delete cascade,
  session_token_hash text not null unique,
  allowed_capability text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table quantos.workspaces is 'Primary workspace registry; phase one keeps a single primary workspace per tenant.';
comment on table quantos.actors is 'Maps Supabase auth users and service principals into QuantOS actors.';
comment on table quantos.workspace_memberships is 'Workspace-scoped actor roles used for RBAC and UI authorization.';
comment on table quantos.accounts is 'Workspace-visible execution or paper accounts anchored to tenant context.';
comment on table quantos.actor_capabilities is 'Deterministic capability grants layered on top of workspace roles.';
comment on table quantos.secret_references is 'Secret metadata and Vault reference allowlist without exposing decrypted material.';
comment on table quantos.execution_service_sessions is 'Short-lived service sessions used by Execution Gateway secret resolution.';

create or replace function quantos.current_actor_id(target_tenant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = quantos, auth, public
as $$
  select actor.id
  from quantos.actors as actor
  where actor.tenant_id = target_tenant_id
    and actor.user_id = auth.uid()
    and actor.actor_kind = 'user'
    and actor.is_active = true
  limit 1;
$$;

create or replace function quantos.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = quantos, auth, public
as $$
  select exists (
    select 1
    from quantos.workspace_memberships as membership
    join quantos.actors as actor on actor.id = membership.actor_id
    where membership.workspace_id = target_workspace_id
      and actor.user_id = auth.uid()
      and actor.actor_kind = 'user'
      and actor.is_active = true
  );
$$;

create or replace function quantos.has_account_access(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = quantos, auth, public
as $$
  select exists (
    select 1
    from quantos.accounts as account
    where account.id = target_account_id
      and account.is_active = true
      and quantos.is_workspace_member(account.workspace_id)
  );
$$;

create or replace function quantos.current_user_has_capability(
  target_tenant_id uuid,
  required_capability text,
  target_mode text default null,
  target_account_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = quantos, auth, public
as $$
  select exists (
    select 1
    from quantos.actor_capabilities as capability
    join quantos.actors as actor on actor.id = capability.actor_id
    where capability.tenant_id = target_tenant_id
      and actor.user_id = auth.uid()
      and actor.actor_kind = 'user'
      and actor.is_active = true
      and capability.capability = required_capability
      and (target_mode is null or capability.mode_scope is null or capability.mode_scope = target_mode)
      and (target_account_id is null or capability.account_id is null or capability.account_id = target_account_id)
  );
$$;

create or replace function quantos.resolve_execution_secret_reference(
  input_session_token_hash text,
  input_secret_name text,
  input_required_capability text
)
returns table (
  tenant_id uuid,
  actor_id uuid,
  secret_name text,
  vault_path text,
  required_capability text,
  session_expires_at timestamptz
)
language sql
stable
security definer
set search_path = quantos, auth, public
as $$
  select session.tenant_id,
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
   and secret.secret_name = input_secret_name
   and secret.rotation_state = 'active'
  where session.session_token_hash = input_session_token_hash
    and session.revoked_at is null
    and session.expires_at > now()
    and session.allowed_capability = input_required_capability
    and secret.required_capability = input_required_capability
    and exists (
      select 1
      from quantos.actor_capabilities as capability
      where capability.actor_id = session.actor_id
        and capability.capability = input_required_capability
    );
$$;

revoke all on function quantos.current_actor_id(uuid) from public;
revoke all on function quantos.is_workspace_member(uuid) from public;
revoke all on function quantos.has_account_access(uuid) from public;
revoke all on function quantos.current_user_has_capability(uuid, text, text, uuid) from public;
revoke all on function quantos.resolve_execution_secret_reference(text, text, text) from public;

grant execute on function quantos.current_actor_id(uuid) to authenticated, service_role;
grant execute on function quantos.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function quantos.has_account_access(uuid) to authenticated, service_role;
grant execute on function quantos.current_user_has_capability(uuid, text, text, uuid) to authenticated, service_role;
grant execute on function quantos.resolve_execution_secret_reference(text, text, text) to service_role;

alter table quantos.workspaces enable row level security;
alter table quantos.workspaces force row level security;
alter table quantos.actors enable row level security;
alter table quantos.actors force row level security;
alter table quantos.workspace_memberships enable row level security;
alter table quantos.workspace_memberships force row level security;
alter table quantos.accounts enable row level security;
alter table quantos.accounts force row level security;
alter table quantos.actor_capabilities enable row level security;
alter table quantos.actor_capabilities force row level security;
alter table quantos.secret_references enable row level security;
alter table quantos.secret_references force row level security;
alter table quantos.execution_service_sessions enable row level security;
alter table quantos.execution_service_sessions force row level security;

create policy "workspaces_select_member"
  on quantos.workspaces
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "workspaces_service_role_all"
  on quantos.workspaces
  for all
  to service_role
  using (true)
  with check (true);

create policy "actors_select_member"
  on quantos.actors
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "actors_service_role_all"
  on quantos.actors
  for all
  to service_role
  using (true)
  with check (true);

create policy "workspace_memberships_select_member"
  on quantos.workspace_memberships
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "workspace_memberships_service_role_all"
  on quantos.workspace_memberships
  for all
  to service_role
  using (true)
  with check (true);

create policy "accounts_select_member"
  on quantos.accounts
  for select
  to authenticated
  using (quantos.has_account_access(id));

create policy "accounts_service_role_all"
  on quantos.accounts
  for all
  to service_role
  using (true)
  with check (true);

create policy "actor_capabilities_select_member"
  on quantos.actor_capabilities
  for select
  to authenticated
  using (
    actor_id = quantos.current_actor_id(tenant_id)
    or quantos.is_tenant_member(tenant_id)
  );

create policy "actor_capabilities_service_role_all"
  on quantos.actor_capabilities
  for all
  to service_role
  using (true)
  with check (true);

create policy "secret_references_service_role_all"
  on quantos.secret_references
  for all
  to service_role
  using (true)
  with check (true);

create policy "execution_service_sessions_service_role_all"
  on quantos.execution_service_sessions
  for all
  to service_role
  using (true)
  with check (true);

commit;
