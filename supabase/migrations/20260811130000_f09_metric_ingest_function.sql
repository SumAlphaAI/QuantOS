begin;

create or replace function quantos.record_operational_metric(
  input_tenant_id uuid,
  input_metric_name text,
  input_metric_value double precision,
  input_source text,
  input_correlation_id uuid default null,
  input_attributes jsonb default '{}'::jsonb,
  input_observed_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
set search_path = quantos
as $$
declare
  inserted_id uuid;
begin
  if input_source is null or btrim(input_source) = '' then
    raise exception 'metric source is required';
  end if;
  if input_attributes::text ~* '(secret|token|password|api[_-]?key|authorization|credential|session)' then
    raise exception 'metric attributes contain a forbidden sensitive key';
  end if;
  insert into quantos.operational_metric_samples (
    tenant_id, metric_name, metric_value, source, correlation_id, attributes, observed_at
  ) values (
    input_tenant_id, input_metric_name, input_metric_value, input_source,
    input_correlation_id, input_attributes, input_observed_at
  )
  returning id into inserted_id;
  return inserted_id;
end;
$$;

revoke all on function quantos.record_operational_metric(uuid, text, double precision, text, uuid, jsonb, timestamptz) from public;
revoke all on function quantos.record_operational_metric(uuid, text, double precision, text, uuid, jsonb, timestamptz) from authenticated;
revoke all on function quantos.record_operational_metric(uuid, text, double precision, text, uuid, jsonb, timestamptz) from anon;
grant execute on function quantos.record_operational_metric(uuid, text, double precision, text, uuid, jsonb, timestamptz) to service_role;
grant execute on function quantos.record_operational_metric(uuid, text, double precision, text, uuid, jsonb, timestamptz) to quantos_execution_gateway;

comment on function quantos.record_operational_metric(uuid, text, double precision, text, uuid, jsonb, timestamptz) is
  'Validated F09 numeric metric intake. RLS limits the Execution Gateway to Vault failure metrics and forbids sensitive attribute keys.';

commit;
