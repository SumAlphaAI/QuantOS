begin;

create table quantos.bff_sessions (
  session_hash text primary key check (length(session_hash) = 64),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index bff_sessions_user_expiry_idx on quantos.bff_sessions(user_id, expires_at);
alter table quantos.bff_sessions enable row level security;
alter table quantos.bff_sessions force row level security;
create policy "bff_sessions_role_all" on quantos.bff_sessions
  for all to quantos_bff using (true) with check (true);
grant select, insert, delete on quantos.bff_sessions to quantos_bff;

comment on table quantos.bff_sessions is
  'Opaque short-lived server-side sessions created only after Supabase Auth verifies the access token; no bearer token is stored.';

commit;
