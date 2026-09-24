begin;

alter table quantos.workflow_tool_rate_windows
  add column effective_limit integer not null default 2147483647,
  add constraint workflow_tool_rate_windows_within_limit
    check (effective_limit > 0 and accepted_count <= effective_limit);

commit;
