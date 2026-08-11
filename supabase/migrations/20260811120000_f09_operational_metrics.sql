begin;

create table if not exists quantos.operational_metric_samples (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references quantos.tenants(id) on delete cascade,
  metric_name text not null check (metric_name in (
    'realtime_projection_delay_secs',
    'realtime_quota_utilization',
    'risk_query_latency_ms',
    'portfolio_query_latency_ms',
    'risk_mv_freshness_secs',
    'ops_aggregate_freshness_secs',
    'storage_operation_error',
    'secret_rotation_failure',
    'secret_read_failure'
  )),
  metric_value double precision not null check (metric_value >= 0),
  source text not null,
  correlation_id uuid,
  attributes jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now()
);

create index if not exists idx_operational_metric_samples_window
  on quantos.operational_metric_samples (metric_name, observed_at desc);

create table if not exists quantos.capacity_alert_window_state (
  scope text not null default 'global',
  rule_id text not null,
  first_breach_at timestamptz,
  consecutive_breaches integer not null default 0 check (consecutive_breaches >= 0),
  last_observed_at timestamptz not null,
  primary key (scope, rule_id)
);

create table if not exists quantos.capacity_alerts (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global',
  rule_id text not null,
  severity text not null check (severity in ('warning', 'critical')),
  summary text not null,
  observed_value jsonb not null,
  threshold jsonb not null,
  triggered_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (scope, rule_id, triggered_at)
);

create index if not exists idx_capacity_alerts_triggered_at
  on quantos.capacity_alerts (triggered_at desc);

comment on table quantos.operational_metric_samples is
  'F09 raw operational measurements. Values and safe labels only; secrets and request payloads are forbidden.';
comment on table quantos.capacity_alert_window_state is
  'Restart-safe state for duration and consecutive-breach capacity alert windows.';
comment on table quantos.capacity_alerts is
  'Persisted F09 capacity alerts used as dashboard and ADR evidence input.';

alter table quantos.operational_metric_samples enable row level security;
alter table quantos.operational_metric_samples force row level security;
alter table quantos.capacity_alert_window_state enable row level security;
alter table quantos.capacity_alert_window_state force row level security;
alter table quantos.capacity_alerts enable row level security;
alter table quantos.capacity_alerts force row level security;

create policy "operational_metric_samples_service_role_all"
  on quantos.operational_metric_samples
  for all
  to service_role
  using (true)
  with check (true);

create policy "operational_metric_samples_gateway_insert"
  on quantos.operational_metric_samples
  for insert
  to quantos_execution_gateway
  with check (metric_name in ('secret_rotation_failure', 'secret_read_failure'));

create policy "capacity_alert_window_state_service_role_all"
  on quantos.capacity_alert_window_state
  for all
  to service_role
  using (true)
  with check (true);

create policy "capacity_alerts_service_role_all"
  on quantos.capacity_alerts
  for all
  to service_role
  using (true)
  with check (true);

grant insert on quantos.operational_metric_samples to quantos_execution_gateway;

commit;
