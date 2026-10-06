begin;
-- BFF uses its dedicated non-superuser role. F05 visibility is narrowed to the
-- authenticated actor; explicit workspace/account scopes must also match.
grant select,insert on quantos.audit_entries to quantos_bff;
create policy bff_audit_select on quantos.audit_entries for select to quantos_bff using (
 tenant_id=nullif(current_setting('quantos.audit_tenant',true),'')::uuid
 and actor_id=nullif(current_setting('quantos.audit_actor',true),'')::uuid
 and (details->>'workspaceId' is null or details->>'workspaceId'=current_setting('quantos.audit_workspace',true))
 and (details->>'accountId' is null or details->>'accountId'=current_setting('quantos.audit_account',true))
);
create policy bff_audit_insert on quantos.audit_entries for insert to quantos_bff with check (
 tenant_id=nullif(current_setting('quantos.audit_tenant',true),'')::uuid
 and actor_id=nullif(current_setting('quantos.audit_actor',true),'')::uuid
 and details->>'workspaceId'=current_setting('quantos.audit_workspace',true)
 and coalesce(details->>'accountId','')=current_setting('quantos.audit_account',true)
);
create table quantos.bff_export_jobs (
 export_id uuid primary key, user_id uuid not null, tenant_id uuid not null,
 actor_id uuid not null, workspace_id uuid not null, account_id uuid,
 session_hash text not null, intent jsonb not null, snapshot jsonb not null,
 job jsonb not null, status text not null check(status in ('queued','generating','ready','cancel_requested','cancelled','expired','failed')),
 retention_until timestamptz not null, object_key text not null unique,
 sha256 text, size_bytes bigint, media_type text,
 attempts integer not null default 0, lease_token uuid, lease_until timestamptz,
 object_deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(tenant_id,actor_id) references quantos.actors(tenant_id,id)
);
create index bff_export_worker on quantos.bff_export_jobs(status,lease_until);
create index bff_export_owner on quantos.bff_export_jobs(user_id,created_at);
create table quantos.bff_audit_cursors (
 token_hash text primary key, user_id uuid not null, binding jsonb not null,
 snapshot jsonb not null, position integer not null check(position>0), expires_at timestamptz not null
);
create table quantos.bff_export_tickets (
 ticket_id uuid primary key, signature_hash text not null, export_id uuid not null references quantos.bff_export_jobs,
 user_id uuid not null, session_hash text not null, expires_at timestamptz not null,
 consumed_at timestamptz, revoked_at timestamptz
);
create table quantos.bff_audit_quotas (
 user_id uuid not null, operation text not null, window_at timestamptz not null,
 used integer not null check(used>=0), primary key(user_id,operation,window_at)
);
do $$ declare item text; begin
 foreach item in array array['bff_export_jobs','bff_audit_cursors','bff_export_tickets','bff_audit_quotas'] loop
 execute format('alter table quantos.%I enable row level security',item);
 execute format('alter table quantos.%I force row level security',item);
 execute format('create policy bff_role_only on quantos.%I for all to quantos_bff using(true) with check(true)',item);
 execute format('revoke all on quantos.%I from anon,authenticated',item);
 execute format('grant select,insert,update,delete on quantos.%I to quantos_bff',item);
 end loop;
end $$;
-- Storage is private. Only the server-side Storage credential can retrieve
-- objects; consumers receive an authenticated, revocable BFF resource lease.
insert into storage.buckets(id,name,public,file_size_limit)
 values('quantos-bff-exports','quantos-bff-exports',false,16777216)
 on conflict(id) do update set public=false,file_size_limit=16777216;
commit;
