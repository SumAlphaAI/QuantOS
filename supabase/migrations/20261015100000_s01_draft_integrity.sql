begin;

-- Existing rows are preserved. New writes must keep tenant/workspace/audit lineage intact.
create function quantos.s01_guard_draft() returns trigger
language plpgsql set search_path = pg_catalog, quantos as $$
begin
  -- Preserve the original auth.users FK ON DELETE SET NULL action, without allowing
  -- callers to clear audit identity or modify any other field through that exception.
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1
     and old.created_by_user is not null and new.created_by_user is null
     and (to_jsonb(new) - 'created_by_user') = (to_jsonb(old) - 'created_by_user') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.head_version <> 0 then
      raise exception 'S01 draft must start at version zero' using errcode = '23514';
    end if;
  else
    if (new.draft_id, new.tenant_id, new.workspace_id, new.owner_actor_id,
        new.created_by_actor, new.created_by_user, new.created_at)
       is distinct from
       (old.draft_id, old.tenant_id, old.workspace_id, old.owner_actor_id,
        old.created_by_actor, old.created_by_user, old.created_at) then
      raise exception 'S01 draft identity and audit lineage are immutable' using errcode = '23514';
    end if;
    if new.head_version <> old.head_version + 1 or new.updated_at < old.updated_at
       or not exists (select 1 from quantos.strategy_draft_versions v
         where v.tenant_id = new.tenant_id and v.draft_id = new.draft_id
           and v.version = new.head_version and v.created_at = new.updated_at) then
      raise exception 'S01 head must advance to a persisted version' using errcode = '23514';
    end if;
  end if;
  if new.created_by_user is null
     or not exists (select 1 from quantos.workspaces w where w.id = new.workspace_id and w.tenant_id = new.tenant_id)
     or not exists (select 1 from quantos.actors a where a.id = new.owner_actor_id and a.tenant_id = new.tenant_id)
     or not exists (select 1 from quantos.actors a where a.id = new.created_by_actor and a.tenant_id = new.tenant_id) then
    raise exception 'S01 draft tenant or auth.users audit chain invalid' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger s01_guard_draft before insert or update on quantos.strategy_drafts
for each row execute function quantos.s01_guard_draft();

create function quantos.s01_guard_version() returns trigger
language plpgsql set search_path = pg_catalog, quantos as $$
declare d quantos.strategy_drafts; r jsonb;
begin
  -- Preserve the original auth.users FK ON DELETE SET NULL action, without allowing
  -- callers to clear audit identity or modify any other field through that exception.
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1
     and old.created_by_user is not null and new.created_by_user is null
     and (to_jsonb(new) - 'created_by_user') = (to_jsonb(old) - 'created_by_user') then
    return new;
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from quantos.strategy_drafts where draft_id = old.draft_id) then
      raise exception 'S01 version deletion requires parent draft removal' using errcode = '23514';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'S01 versions are immutable' using errcode = '23514';
  end if;
  select * into d from quantos.strategy_drafts
    where draft_id = new.draft_id and tenant_id = new.tenant_id for update;
  if not found or new.version <> d.head_version + 1 or new.created_at < d.updated_at
     or new.created_by_user is null
     or not exists (select 1 from quantos.actors a where a.id = new.created_by_actor and a.tenant_id = new.tenant_id) then
    raise exception 'S01 version conflict or audit lineage invalid' using errcode = '23514';
  end if;
  -- Incomplete WIP is allowed, but every supplied reference must already be approved.
  if new.data_snapshot_id is not null and not exists (
    select 1 from quantos.data_snapshots s where s.id = new.data_snapshot_id
      and s.tenant_id = new.tenant_id and s.quality = 'passed'
      and length(trim(s.license_label)) > 0 and s.expires_at > new.created_at
  ) then
    raise exception 'S01 snapshot reference is not approved' using errcode = '23514';
  end if;
  for r in select value from jsonb_array_elements(new.artifact_refs) loop
    if jsonb_typeof(r) <> 'object' or not (r ?& array['artifact_id', 'content_hash'])
       or not exists (select 1 from quantos.object_artifacts a
         where a.tenant_id = new.tenant_id and a.artifact_id::text = r->>'artifact_id'
           and a.content_hash = r->>'content_hash') then
      raise exception 'S01 Artifact id/hash reference is not approved' using errcode = '23514';
    end if;
  end loop;
  return new;
end $$;
create trigger s01_guard_version before insert or update or delete on quantos.strategy_draft_versions
for each row execute function quantos.s01_guard_version();

-- Reject a transaction that appends a version but fails to advance its head.
create function quantos.s01_check_committed_head() returns trigger
language plpgsql set search_path = pg_catalog, quantos as $$
begin
  if exists (select 1 from quantos.strategy_drafts d where d.draft_id = new.draft_id
    and (d.head_version < new.version or d.head_version <> (
      select max(v.version) from quantos.strategy_draft_versions v where v.draft_id = d.draft_id))) then
    raise exception 'S01 version and head must commit atomically' using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger s01_check_committed_head after insert on quantos.strategy_draft_versions
  deferrable initially deferred for each row execute function quantos.s01_check_committed_head();

alter table quantos.strategy_drafts enable row level security;
alter table quantos.strategy_drafts force row level security;
alter table quantos.strategy_draft_versions enable row level security;
alter table quantos.strategy_draft_versions force row level security;
drop policy "strategy_drafts_select_member" on quantos.strategy_drafts;
create policy "strategy_drafts_select_member" on quantos.strategy_drafts for select to authenticated
  using (quantos.is_tenant_member(tenant_id) and quantos.is_workspace_member(workspace_id));
drop policy "strategy_draft_versions_select_member" on quantos.strategy_draft_versions;
create policy "strategy_draft_versions_select_member" on quantos.strategy_draft_versions for select to authenticated
  using (exists (select 1 from quantos.strategy_drafts d where d.draft_id = strategy_draft_versions.draft_id
    and d.tenant_id = strategy_draft_versions.tenant_id and quantos.is_workspace_member(d.workspace_id)));
revoke all on function quantos.s01_guard_draft(), quantos.s01_guard_version(), quantos.s01_check_committed_head() from public;

commit;
