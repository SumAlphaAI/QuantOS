begin;

create table quantos.bff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  notifications jsonb not null check (jsonb_typeof(notifications) = 'object'),
  updated_at timestamptz not null default now()
);
create table quantos.bff_devices (
  device_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  trusted boolean not null default false,
  trusted_until timestamptz not null,
  created_at timestamptz not null default now()
);
create table quantos.bff_session_details (
  session_hash text primary key references quantos.bff_sessions(session_hash) on delete cascade,
  session_id uuid not null unique,
  device_id uuid not null references quantos.bff_devices(device_id),
  csrf_hash text not null check (length(csrf_hash) = 64),
  client text not null default 'Web',
  platform text not null default 'Browser',
  last_active_at timestamptz not null default now()
);
create table quantos.bff_security_commands (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  idempotency_key uuid not null,
  intent jsonb not null,
  response jsonb not null,
  completed boolean not null default false,
  upstream_started boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, operation, idempotency_key)
);
create table quantos.bff_auth_challenges (
  challenge_ref uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_hash text not null references quantos.bff_sessions(session_hash) on delete cascade,
  purpose text not null check (purpose in ('login','security_change','approval','kill_switch')),
  factor_id uuid not null,
  upstream_challenge uuid not null,
  expires_at timestamptz not null,
  verified_at timestamptz,
  consumed boolean not null default false
);
create index bff_auth_challenge_lookup on quantos.bff_auth_challenges(user_id,session_hash,purpose,expires_at);
create table quantos.bff_reauth_grants (
  grant_ref uuid primary key,
  session_hash text not null references quantos.bff_sessions(session_hash) on delete cascade,
  expires_at timestamptz not null,
  scope text not null check (scope in ('security','first_factor'))
);
create table quantos.bff_mfa_windows (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  failures integer not null default 0 check (failures >= 0)
);
create table quantos.bff_settings_events (
  sequence bigint not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event jsonb not null check (jsonb_typeof(event) = 'object'),
  primary key (user_id,sequence),
  created_at timestamptz not null default now()
);
create index bff_settings_events_user_sequence on quantos.bff_settings_events(user_id,sequence);
create table quantos.bff_settings_audits (
  audit_ref uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  tenant_id uuid references quantos.tenants(id),
  actor_id uuid,
  action text not null,
  object_ref text not null,
  correlation_id uuid not null,
  created_at timestamptz not null default now()
);
create table quantos.bff_access_requests (
  request_id uuid primary key,
  request jsonb not null check (jsonb_typeof(request) = 'object'),
  source_hash text not null,
  created_at timestamptz not null default now()
);
create index bff_access_request_source_time on quantos.bff_access_requests(source_hash,created_at);

do $$
declare item text;
begin
  foreach item in array array['bff_profiles','bff_devices','bff_session_details',
    'bff_security_commands','bff_auth_challenges','bff_reauth_grants','bff_mfa_windows',
    'bff_settings_events','bff_settings_audits','bff_access_requests'] loop
    execute format('alter table quantos.%I enable row level security', item);
    execute format('alter table quantos.%I force row level security', item);
    execute format('create policy bff_role_only on quantos.%I for all to quantos_bff using (true) with check (true)', item);
  end loop;
end $$;
grant select,insert,update on quantos.bff_profiles,quantos.bff_devices,
  quantos.bff_session_details,quantos.bff_security_commands,quantos.bff_auth_challenges,
  quantos.bff_reauth_grants,quantos.bff_mfa_windows to quantos_bff;
grant delete on quantos.bff_devices,quantos.bff_reauth_grants to quantos_bff;
grant select,insert on quantos.bff_settings_events,quantos.bff_settings_audits,
  quantos.bff_access_requests to quantos_bff;
grant update(mfa_verified) on quantos.bff_sessions to quantos_bff;

comment on table quantos.bff_security_commands is
  'Actor-scoped durable operation/key/intents, job and audit references; no bearer, code or enrollment material.';
comment on table quantos.bff_settings_audits is
  'Append-only BFF security audit references. Domain audit ledger integration belongs to BFF-FE-007.';
comment on table quantos.bff_session_details is
  'Opaque session metadata and CSRF digest; session secrets and identity provider bearer tokens are not persisted.';
commit;
