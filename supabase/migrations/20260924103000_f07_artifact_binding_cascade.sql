begin;

alter table quantos.workflow_run_artifacts
  drop constraint workflow_run_artifacts_tenant_run_fk,
  drop constraint workflow_run_artifacts_tenant_artifact_fk;

alter table quantos.workflow_run_artifacts
  add constraint workflow_run_artifacts_tenant_run_fk
    foreign key (tenant_id, workflow_run_id)
    references quantos.workflow_runs (tenant_id, id) on delete cascade,
  add constraint workflow_run_artifacts_tenant_artifact_fk
    foreign key (tenant_id, artifact_id)
    references quantos.object_artifacts (tenant_id, artifact_id) on delete cascade;

commit;
