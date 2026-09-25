-- A user actor has no service_name, and a service actor has no user_id.
-- NULLS NOT DISTINCT on both columns accidentally limited each tenant to one
-- user actor and one service actor. Preserve uniqueness of actual identities.
alter table quantos.actors
  drop constraint if exists actors_tenant_id_user_id_key,
  drop constraint if exists actors_tenant_id_service_name_key;

create unique index if not exists actors_tenant_user_id_unique
  on quantos.actors (tenant_id, user_id)
  where user_id is not null;

create unique index if not exists actors_tenant_service_name_unique
  on quantos.actors (tenant_id, service_name)
  where service_name is not null;
