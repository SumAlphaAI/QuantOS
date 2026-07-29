begin;

create schema if not exists quantos;
create extension if not exists "pgcrypto" with schema extensions;

create table if not exists quantos.schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists quantos.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quantos.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'approver', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

comment on schema quantos is 'QuantOS domain schema managed by Supabase migrations.';
comment on table quantos.schema_migrations is 'Tracks migrations applied to the target Supabase PostgreSQL database.';
comment on table quantos.tenants is 'Primary tenant registry for QuantOS.';
comment on table quantos.tenant_memberships is 'Maps Supabase auth users into QuantOS tenant roles.';

alter table quantos.tenants enable row level security;
alter table quantos.tenant_memberships enable row level security;

create policy "tenants_select_for_members"
  on quantos.tenants
  for select
  to authenticated
  using (
    exists (
      select 1
      from quantos.tenant_memberships as membership
      where membership.tenant_id = tenants.id
        and membership.user_id = auth.uid()
    )
  );

create policy "tenants_service_role_all"
  on quantos.tenants
  for all
  to service_role
  using (true)
  with check (true);

create policy "tenant_memberships_select_self"
  on quantos.tenant_memberships
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "tenant_memberships_service_role_all"
  on quantos.tenant_memberships
  for all
  to service_role
  using (true)
  with check (true);

commit;
