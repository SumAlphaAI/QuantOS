begin;

create table if not exists quantos.portfolio_positions (
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  account_id uuid not null references quantos.accounts(id) on delete cascade,
  symbol text not null,
  quantity double precision not null,
  average_entry_price double precision not null,
  realized_pnl double precision not null default 0,
  last_event_sequence bigint not null check (last_event_sequence >= 0),
  as_of timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, account_id, symbol)
);

create table if not exists quantos.portfolio_marks (
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  symbol text not null,
  price double precision not null,
  as_of timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, symbol)
);

create table if not exists quantos.portfolio_accounts (
  tenant_id uuid not null references quantos.tenants(id) on delete cascade,
  account_id uuid not null references quantos.accounts(id) on delete cascade,
  realized_pnl double precision not null default 0,
  unrealized_pnl double precision not null default 0,
  exposure_gross double precision not null default 0,
  exposure_net double precision not null default 0,
  last_event_sequence bigint not null check (last_event_sequence >= 0),
  as_of timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, account_id)
);

create index if not exists idx_portfolio_positions_tenant_account
  on quantos.portfolio_positions (tenant_id, account_id);

comment on table quantos.portfolio_positions is 'Rebuildable portfolio position read model projected from order/fill events.';
comment on table quantos.portfolio_marks is 'Latest mark prices feeding portfolio valuation and exposure.';
comment on table quantos.portfolio_accounts is 'Account-level realized/unrealized P&L and exposure snapshot used as risk input.';

alter table quantos.portfolio_positions enable row level security;
alter table quantos.portfolio_positions force row level security;
alter table quantos.portfolio_marks enable row level security;
alter table quantos.portfolio_marks force row level security;
alter table quantos.portfolio_accounts enable row level security;
alter table quantos.portfolio_accounts force row level security;

create policy "portfolio_positions_select_member"
  on quantos.portfolio_positions
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "portfolio_positions_service_role_all"
  on quantos.portfolio_positions
  for all
  to service_role
  using (true)
  with check (true);

create policy "portfolio_marks_select_member"
  on quantos.portfolio_marks
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "portfolio_marks_service_role_all"
  on quantos.portfolio_marks
  for all
  to service_role
  using (true)
  with check (true);

create policy "portfolio_accounts_select_member"
  on quantos.portfolio_accounts
  for select
  to authenticated
  using (quantos.is_tenant_member(tenant_id));

create policy "portfolio_accounts_service_role_all"
  on quantos.portfolio_accounts
  for all
  to service_role
  using (true)
  with check (true);

commit;
