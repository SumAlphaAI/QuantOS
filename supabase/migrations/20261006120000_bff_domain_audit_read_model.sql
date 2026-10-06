begin;
-- Read-only access to the F05 domain envelope is constrained exactly like the
-- actor-owned audit rows. No event mutation/dispatch privilege is granted.
grant select on quantos.event_log to quantos_bff;
create policy bff_domain_event_select on quantos.event_log for select to quantos_bff using (
 tenant_id=nullif(current_setting('quantos.audit_tenant',true),'')::uuid
 and actor_id=nullif(current_setting('quantos.audit_actor',true),'')::uuid
 and (coalesce(payload->>'workspaceId',payload->>'workspace_id') is null
      or coalesce(payload->>'workspaceId',payload->>'workspace_id')=current_setting('quantos.audit_workspace',true))
 and (coalesce(payload->>'accountId',payload->>'account_id') is null
      or coalesce(payload->>'accountId',payload->>'account_id')=current_setting('quantos.audit_account',true))
);
commit;
