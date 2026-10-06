begin;
-- Append future identity audit facts with a real event root. Historical facts
-- and their payloads remain immutable. Function ownership/execute ACL persist.
create or replace function quantos.mirror_bff_settings_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare principal record;
begin
 if new.user_id is null or new.actor_id is null or new.tenant_id is null then return new; end if;
 select w.id as workspace_id,account.id as account_id,count(*) over() as matches
 into principal
 from quantos.actors a
 join quantos.workspace_memberships m on m.actor_id=a.id and m.tenant_id=a.tenant_id
 join quantos.workspaces w on w.id=m.workspace_id and w.tenant_id=a.tenant_id and w.is_primary
 join quantos.accounts account on account.workspace_id=w.id and account.tenant_id=a.tenant_id and account.is_active
 where a.id=new.actor_id and a.user_id=new.user_id and a.tenant_id=new.tenant_id and a.is_active and a.actor_kind='user'
 limit 1;
 if not found or principal.matches<>1 then raise exception 'BFF_AUDIT_IDENTITY_SCOPE' using errcode='42501'; end if;
 insert into quantos.audit_entries(id,tenant_id,actor_id,actor_user_id,correlation_id,causation_id,action,details,recorded_at)
 values(new.audit_ref,new.tenant_id,new.actor_id,new.user_id,new.correlation_id,new.audit_ref,new.action,
 jsonb_build_object('workspaceId',principal.workspace_id,'accountId',principal.account_id,'objectRef',new.object_ref,
 'redactedPayload',jsonb_build_object('redactionPolicy','audit-v1','outcome','succeeded')),new.created_at);
 return new;
end $$;
commit;
