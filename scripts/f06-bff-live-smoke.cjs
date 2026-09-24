const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');

const assert = (condition, message) => { if (!condition) throw Error(message); };
const origin = 'https://f06-local-smoke.invalid';

async function main() {
  for (const name of ['QUANTOS_BFF_DATABASE_URL', 'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY', 'QUANTOS_F06_TEST_EMAIL', 'QUANTOS_F06_TEST_PASSWORD',
    'QUANTOS_F06_TEST_USER_ID', 'QUANTOS_F06_TEST_TENANT_ID', 'QUANTOS_F06_TEST_ACCOUNT_ID']) {
    assert(process.env[name], `${name} is required`);
  }
  const auth = await fetch(new URL('/auth/v1/token?grant_type=password', process.env.SUPABASE_URL), {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: process.env.QUANTOS_F06_TEST_EMAIL,
      password: process.env.QUANTOS_F06_TEST_PASSWORD }),
    signal: AbortSignal.timeout(10000),
  });
  assert(auth.ok, `Supabase test login returned HTTP ${auth.status}`);
  const token = (await auth.json()).access_token;
  assert(token, 'Supabase test login returned no access token');
  const port = 49000 + crypto.randomInt(1000);
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(path.resolve('target/debug/bff-gateway'), [], {
    env: { ...process.env, QUANTOS_BFF_MODE: 'live', QUANTOS_BFF_BIND: `127.0.0.1:${port}`,
      QUANTOS_TERMINAL_ORIGIN: origin, QUANTOS_BFF_ENVIRONMENT: 'dev' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', () => {});
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (child.exitCode !== null) break;
      try {
        const probe = await fetch(`${base}/v1/session`, { signal: AbortSignal.timeout(1000) });
        if (probe.status === 401) { ready = true; break; }
      } catch { /* startup has not finished */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert(ready, `live BFF did not start (${child.exitCode === null ? 'timeout' : 'exited'})`);
    const request = (route, options = {}) => fetch(`${base}${route}`, {
      ...options, signal: AbortSignal.timeout(15000),
    });
    const missing = await request('/v1/session');
    assert(missing.status === 401, 'missing cookie was not rejected');
    const wrongOrigin = await request('/v1/auth/session', { method: 'POST',
      headers: { origin: 'https://other.invalid', authorization: `Bearer ${token}` } });
    assert(wrongOrigin.status === 403, 'foreign Origin was not rejected');
    const invalidToken = await request('/v1/auth/session', { method: 'POST',
      headers: { origin, authorization: 'Bearer invalid-token' } });
    assert(invalidToken.status === 401, 'unverified bearer was not rejected');
    const established = await request('/v1/auth/session', { method: 'POST',
      headers: { origin, authorization: `Bearer ${token}` } });
    assert(established.status === 204, `session handshake returned HTTP ${established.status}`);
    const cookie = established.headers.get('set-cookie')?.split(';')[0];
    assert(cookie?.startsWith('quantos_session='), 'opaque BFF cookie was not issued');
    assert(established.headers.get('cache-control') === 'no-store', 'session cookie was cacheable');
    const session = await request('/v1/session', { headers: { cookie } });
    assert(session.status === 200, `session read returned HTTP ${session.status}`);
    const context = await session.json();
    assert(context.actorId && context.userId === undefined, 'unexpected session context shape');
    assert(context.tenantId === process.env.QUANTOS_F06_TEST_TENANT_ID, 'tenant mismatch');
    assert(context.accountId === process.env.QUANTOS_F06_TEST_ACCOUNT_ID, 'account mismatch');
    assert(context.mfaState === 'challenged', 'AAL1 test session must not assert MFA');
    assert(context.capabilities.includes('execution.operate'), 'server capability mapping missing');
    assert(session.headers.get('x-correlation-id'), 'session correlation ID missing');
    const validContext = await request('/v1/context', { headers: { cookie } });
    assert(validContext.status === 200, 'valid primary context was not returned');
    const hidden = await request('/v1/context', { headers: {
      cookie, 'x-account-id': crypto.randomUUID(),
    } });
    assert(hidden.status === 404, 'foreign account was not hidden');
    assert(hidden.headers.get('x-correlation-id'), 'hidden-resource correlation ID missing');
    const revoked = await request('/v1/auth/logout', { method: 'POST', headers: { origin, cookie } });
    assert(revoked.status === 204, 'logout failed');
    const afterRevoke = await request('/v1/session', { headers: { cookie } });
    assert(afterRevoke.status === 401, 'revoked session remained valid');
    console.log(JSON.stringify({ status: 'PASS', originKind: 'synthetic_http_smoke',
      realSupabaseAuth: true, independentBffLogin: true,
      checks: ['auth_login', 'missing_cookie', 'foreign_origin', 'invalid_token',
        'opaque_cookie', 'session_context', 'primary_context', 'hidden_account',
        'server_revocation'],
      browserAcceptance: 'NOT_RUN', mfaAal2: 'NOT_RUN', pageCapabilityRoutes: 'NOT_RUN' }));
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error(`F06 live BFF smoke failed: ${error.message}`);
  process.exitCode = 1;
});
