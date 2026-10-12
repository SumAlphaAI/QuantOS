const databaseMessages = new Set(['Database error granting user', 'Database error querying schema', 'Database error saving new user']);
const safeCodes = new Set(['unexpected_failure', 'invalid_credentials', 'over_request_rate_limit', 'user_already_exists', 'email_exists']);
function requireAuthResponse(response, data) {
  if (response.ok) return;
  // Never retain arbitrary Auth bodies: they may contain identities or tokens.
  const message = [data?.msg, data?.message, data?.error_description].find(value => databaseMessages.has(value));
  const diagnostic = { status: response.status,
    errorCode: safeCodes.has(data?.error_code) ? data.error_code : 'OTHER_OR_ABSENT',
    messageClass: message || 'OTHER_OR_ABSENT' };
  throw Object.assign(Error(`Supabase Auth returned HTTP ${response.status} (${diagnostic.messageClass})`),
    { code: message ? 'SUPABASE_AUTH_DATABASE_FAILURE' : 'SUPABASE_AUTH_HTTP_FAILURE', authFailure: diagnostic });
}
module.exports = { requireAuthResponse };
