begin;

alter table quantos.bff_sessions
  add column mfa_verified boolean not null default false;

comment on column quantos.bff_sessions.mfa_verified is
  'True only when the Supabase-verified access token carried aal2 at session issuance.';

commit;
