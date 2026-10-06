// These keys are supplied by the BFF identity/command flow. A random database
// default would hide an omitted identity or caller idempotency token.
const explicitKeys = new Set([
  'bff_access_requests.request_id',
  'bff_audit_quotas.user_id',
  'bff_export_jobs.export_id',
  'bff_export_tickets.ticket_id',
  'bff_auth_challenges.challenge_ref',
  'bff_devices.device_id',
  'bff_reauth_grants.grant_ref',
  'bff_security_commands.idempotency_key',
  'bff_settings_audits.audit_ref',
]);
function assertUuidDefaults(rows) {
  const missing = rows.filter(row => !explicitKeys.has(`${row.table_name}.${row.column_name}`));
  if (missing.length) throw new Error(`UUID primary-key columns must define database defaults: ${missing.map(row => `${row.table_name}.${row.column_name}`).join(', ')}`);
}
module.exports = {assertUuidDefaults, explicitKeys};
