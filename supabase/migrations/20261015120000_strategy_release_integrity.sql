begin;

-- Existing candidates lack authenticated S02 provenance and cannot deploy after this migration.
alter table quantos.strategy_releases add column if not exists workspace_id uuid references quantos.workspaces(id) on delete restrict;
alter table quantos.strategy_releases add column if not exists validation_evidence jsonb;
alter table quantos.strategy_releases add column if not exists approval_evidence jsonb;
update quantos.strategy_releases r set workspace_id=d.workspace_id
from quantos.strategy_drafts d where d.draft_id=r.draft_id and d.tenant_id=r.tenant_id and r.workspace_id is null;

create or replace function quantos.guard_strategy_release_v2() returns trigger
language plpgsql set search_path = pg_catalog, quantos as $$
begin
  if TG_OP = 'UPDATE' and pg_trigger_depth() > 1
    and OLD.created_by_user is not null and NEW.created_by_user is null
    and (to_jsonb(NEW) - 'created_by_user') = (to_jsonb(OLD) - 'created_by_user') then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' then
    if (to_jsonb(NEW) - array['approved_at','approved_by_actor','approval_evidence'])
       is distinct from (to_jsonb(OLD) - array['approved_at','approved_by_actor','approval_evidence']) then
      raise exception 'STRATEGY_RELEASE_IMMUTABLE';
    end if;
    if OLD.approved_at is not null then raise exception 'STRATEGY_RELEASE_ALREADY_APPROVED'; end if;
  end if;
  if not exists(select 1 from quantos.strategy_drafts d where d.draft_id=NEW.draft_id
    and d.tenant_id=NEW.tenant_id and d.workspace_id=NEW.workspace_id) then
    raise exception 'STRATEGY_RELEASE_SCOPE_MISMATCH';
  end if;
  if not exists(select 1 from quantos.data_snapshots s where s.id=NEW.data_snapshot_id and s.tenant_id=NEW.tenant_id
    and s.content_hash=NEW.validation_evidence->>'snapshot_hash'
    and s.expires_at=(NEW.validation_evidence->>'valid_until')::timestamptz) then
    raise exception 'STRATEGY_RELEASE_SNAPSHOT_SCOPE_MISMATCH';
  end if;
  if not exists(select 1 from quantos.strategy_draft_versions v where v.tenant_id=NEW.tenant_id
    and v.draft_id=NEW.draft_id and v.version=NEW.draft_version
    and v.content_hash=NEW.validation_evidence #>> '{report,draft,version_hash}') then
    raise exception 'STRATEGY_RELEASE_VERSION_MISMATCH';
  end if;
  if not exists(select 1 from quantos.actors a where a.id=NEW.created_by_actor and a.tenant_id=NEW.tenant_id) then
    raise exception 'STRATEGY_RELEASE_ACTOR_SCOPE_MISMATCH';
  end if;
  if NEW.validation_evidence is null or jsonb_typeof(NEW.validation_evidence) <> 'object'
    or jsonb_typeof(NEW.validation_evidence->'artifact_payload') is distinct from 'object'
    or NEW.name is distinct from NEW.validation_evidence->>'name'
    or NEW.evidence_refs is distinct from NEW.validation_evidence->'evidence_refs'
    or (NEW.validation_evidence #>> '{report,report_hash}') is distinct from NEW.backtest_report_hash
    or (NEW.validation_evidence #>> '{report,draft,tenant_id}') is distinct from NEW.tenant_id::text
    or (NEW.validation_evidence #>> '{report,draft,workspace_id}') is distinct from NEW.workspace_id::text
    or (NEW.validation_evidence #>> '{report,draft,draft_id}') is distinct from NEW.draft_id::text
    or (NEW.validation_evidence #>> '{report,draft,version}')::bigint is distinct from NEW.draft_version
    or (NEW.validation_evidence #>> '{report,candidate,source_commit}') is distinct from NEW.source_digest
    or (NEW.validation_evidence #>> '{report,candidate,image_digest}') is distinct from NEW.image_digest
    or (NEW.validation_evidence #>> '{report,parameter_hash}') is distinct from NEW.parameter_hash
    or (NEW.validation_evidence #>> '{report,snapshot_id}') is distinct from NEW.data_snapshot_id::text
    or (NEW.validation_evidence->>'valid_until') is null
    or (NEW.validation_evidence #>> '{report,generated_at}') is null
    or NEW.created_at < (NEW.validation_evidence #>> '{report,generated_at}')::timestamptz
    or NEW.created_at > (NEW.validation_evidence->>'valid_until')::timestamptz
    or NEW.source_digest !~ '^[a-f0-9]{40}$' or NEW.image_digest !~ '^sha256:[a-f0-9]{64}$'
    or cardinality(NEW.allowed_targets)=0 then
    raise exception 'STRATEGY_RELEASE_UNVERIFIED';
  end if;
  if NEW.approved_at is not null then
    if NEW.approved_by_actor is null or NEW.approval_evidence is null
      or not exists(select 1 from quantos.actors a where a.id=NEW.approved_by_actor and a.tenant_id=NEW.tenant_id)
      or (NEW.approval_evidence->>'actor_id') is distinct from NEW.approved_by_actor::text
      or (NEW.approval_evidence->>'approved_at')::timestamptz is distinct from NEW.approved_at
      or (NEW.approval_evidence->>'expires_at') is null
      or (NEW.approval_evidence->>'content_hash') is distinct from NEW.content_hash
      or NEW.approved_at < NEW.created_at
      or NEW.approved_at >= (NEW.approval_evidence->>'expires_at')::timestamptz
      or (NEW.approval_evidence->>'expires_at')::timestamptz > (NEW.validation_evidence->>'valid_until')::timestamptz then
      raise exception 'STRATEGY_RELEASE_APPROVAL_MISMATCH';
    end if;
  elsif NEW.approved_by_actor is not null or NEW.approval_evidence is not null then
    raise exception 'STRATEGY_RELEASE_APPROVAL_MISMATCH';
  end if;
  return NEW;
end $$;
create trigger strategy_release_v2_guard before insert or update on quantos.strategy_releases
for each row execute function quantos.guard_strategy_release_v2();

create or replace function quantos.guard_strategy_deployment_v2() returns trigger
language plpgsql set search_path = pg_catalog, quantos as $$
declare r quantos.strategy_releases%rowtype;
begin
  select * into r from quantos.strategy_releases where release_id=NEW.release_id and tenant_id=NEW.tenant_id for share;
  if not found or not exists(select 1 from quantos.actors a where a.id=NEW.requested_by_actor and a.tenant_id=NEW.tenant_id) or r.validation_evidence is null or r.approval_evidence is null
    or (r.approval_evidence->>'expires_at') is null
    or r.approved_at is null or r.approved_by_actor is null
    or (r.approval_evidence->>'content_hash') is distinct from r.content_hash
    or not (NEW.target=any(r.allowed_targets)) or NEW.target not in ('paper','shadow')
    or statement_timestamp() < r.approved_at
    or NEW.requested_at < r.approved_at
    or NEW.requested_at >= (r.approval_evidence->>'expires_at')::timestamptz
    or statement_timestamp() >= (r.approval_evidence->>'expires_at')::timestamptz then
    raise exception 'STRATEGY_DEPLOYMENT_REJECTED';
  end if;
  return NEW;
end $$;
create trigger strategy_deployment_v2_guard before insert or update on quantos.strategy_release_deployments
for each row execute function quantos.guard_strategy_deployment_v2();

drop policy if exists "strategy_releases_select_member" on quantos.strategy_releases;
create policy "strategy_releases_select_workspace" on quantos.strategy_releases for select to authenticated
using (quantos.is_tenant_member(tenant_id) and quantos.is_workspace_member(workspace_id));
drop policy if exists "strategy_release_deployments_select_member" on quantos.strategy_release_deployments;
create policy "strategy_release_deployments_select_workspace" on quantos.strategy_release_deployments for select to authenticated
using (quantos.is_tenant_member(tenant_id) and exists(select 1 from quantos.strategy_releases r
  where r.release_id=strategy_release_deployments.release_id and r.tenant_id=strategy_release_deployments.tenant_id
  and quantos.is_workspace_member(r.workspace_id)));
alter table quantos.strategy_releases force row level security;
alter table quantos.strategy_release_deployments force row level security;

revoke all on function quantos.guard_strategy_release_v2(), quantos.guard_strategy_deployment_v2() from public;

comment on column quantos.strategy_releases.validation_evidence is 'Trusted service-only S02 report plus pinned S01 version; JSON/hash integrity is not authentication. Legacy NULL evidence remains unverified.';
commit;
