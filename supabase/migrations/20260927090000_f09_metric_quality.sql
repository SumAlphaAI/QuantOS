begin;

-- Source is a fixed metric identifier, never caller supplied context or a
-- credential. Reject NaN and values outside the declared metric domain.
alter table quantos.operational_metric_samples
  add constraint f09_metric_source_is_name check (source = metric_name),
  add constraint f09_metric_value_domain check (
    metric_value >= 0 and metric_value < 1000000000000 and
    (metric_name not in ('realtime_quota_utilization', 'storage_operation_error',
                         'secret_rotation_failure', 'secret_read_failure')
     or metric_value <= 1)
  );

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
  if input_source is distinct from input_metric_name then
    raise exception 'metric source must be the registered metric name';
  end if;
  if input_observed_at is null or input_observed_at < now() - interval '24 hours'
     or input_observed_at > now() + interval '90 seconds' then
    raise exception 'metric observation timestamp is outside intake window';
  end if;
  if input_attributes is null or jsonb_typeof(input_attributes) <> 'object'
     or input_attributes::text ~* '(secret|token|password|api[_-]?key|authorization|credential|session)' then
    raise exception 'metric attributes contain a forbidden field';
  end if;
  insert into quantos.operational_metric_samples (
    tenant_id, metric_name, metric_value, source, correlation_id, attributes, observed_at
  ) values (
    input_tenant_id, input_metric_name, input_metric_value, input_source,
    input_correlation_id, input_attributes, input_observed_at
  ) returning id into inserted_id;
  return inserted_id;
end;
$$;

commit;
