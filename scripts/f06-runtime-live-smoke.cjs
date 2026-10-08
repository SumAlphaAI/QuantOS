const ready = require('./lib/service-readiness.cjs');
const startupEvidence = require('./lib/runtime-startup-evidence.cjs');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const httpTimeoutMs = require('./lib/f06-http-budget.cjs')();
const assert = (condition, message) => { if (!condition) throw Error(message); };
const origin = 'https://f06-runtime-local-smoke.invalid';
let diagnosticPhase = 'configuration';

async function assertIsolatedIdleRuntime() {
  assert(process.env.QUANTOS_F06_ISOLATED_PROJECT === '1', 'confirmed isolated project flag is required');
  assert(process.env.QUANTOS_F06_ALLOW_TEMP_ADMIN_STORAGE_KEY === '1',
    'explicit temporary Storage key authorization flag is required');
  const supabaseRef = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
  const runtimeUrl = new URL(process.env.QUANTOS_RUNTIME_DATABASE_URL);
  const bffUrl = new URL(process.env.QUANTOS_BFF_DATABASE_URL);
  for (const url of [runtimeUrl, bffUrl]) {
    const ref = url.hostname.startsWith('db.')
      ? url.hostname.split('.')[1] : decodeURIComponent(url.username).split('.').at(-1);
    assert(ref === supabaseRef && url.searchParams.get('sslmode') === 'verify-full',
      'both service URLs must use the isolated Auth project and verify-full TLS');
  }
  const caPath = runtimeUrl.searchParams.get('sslrootcert');
  assert(caPath && fs.statSync(caPath).isFile(), 'Runtime CA file is required');
  const client = new Client({
    host: runtimeUrl.hostname,
    port: Number(runtimeUrl.port || 5432),
    user: decodeURIComponent(runtimeUrl.username),
    password: decodeURIComponent(runtimeUrl.password),
    database: runtimeUrl.pathname.slice(1) || 'postgres',
    ssl: { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    await client.query('set role quantos_runtime');
    const pending = (await client.query(`select count(*)::int as n from quantos.workflow_runs
      where status in ('queued','running','cancel_requested')`)).rows[0].n;
    assert(pending === 0, 'Runtime worker queue must be empty before identity smoke');
  } finally {
    await client.end();
  }
}

function start(binary, port, extra) {
  const child = spawn(path.resolve(`target/debug/${binary}`), [], {
    env: { ...process.env, ...extra, QUANTOS_TERMINAL_ORIGIN: origin },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostic = '';
  child.stdout.on('data', () => {});
  child.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk.toString('utf8')).slice(-6000); });
  return { child, base: `http://127.0.0.1:${port}`,
    startupPhases: () => startupEvidence(diagnostic),
    diagnostic: () => diagnostic
      .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
      .replace(/(?:sb_secret_|eyJ)[A-Za-z0-9_.-]+/g, '[redacted credential]')
      .slice(-6000) };
}

async function main() {
  for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'QUANTOS_BFF_DATABASE_URL', 'QUANTOS_RUNTIME_DATABASE_URL', 'QUANTOS_F06_TEST_EMAIL',
    'QUANTOS_F06_TEST_PASSWORD']) assert(process.env[name], `${name} is required`);
  diagnosticPhase = 'target-idle-check';
  await assertIsolatedIdleRuntime();
  diagnosticPhase = 'supabase-auth-login';
  const login = await fetch(new URL('/auth/v1/token?grant_type=password', process.env.SUPABASE_URL), {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: process.env.QUANTOS_F06_TEST_EMAIL,
      password: process.env.QUANTOS_F06_TEST_PASSWORD }),
    signal: AbortSignal.timeout(httpTimeoutMs),
  });
  assert(login.ok, `Supabase login returned HTTP ${login.status}`);
  const token = (await login.json()).access_token;
  assert(token, 'Supabase login returned no access token');
  const bffPort = 50000 + crypto.randomInt(1000);
  const runtimePort = 51000 + crypto.randomInt(1000);
  const bff = start('bff-gateway', bffPort, {
    QUANTOS_BFF_MODE: 'live', QUANTOS_BFF_BIND: `127.0.0.1:${bffPort}`,
    QUANTOS_BFF_ENVIRONMENT: 'dev',
  });
  let runtime;
  try {
    diagnosticPhase = 'bff-startup';
    await ready(bff, '/v1/session', 401);
    diagnosticPhase = 'bff-session-establish';
    const handshakeStarted = Date.now();
    const established = await fetch(`${bff.base}/v1/auth/session`, {
      method: 'POST', headers: { origin, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(httpTimeoutMs),
    });
    const handshakeElapsedMs = Date.now() - handshakeStarted;
    assert(established.status === 204, `BFF did not establish the real Auth session (HTTP ${established.status}; ${bff.diagnostic()})`);
    const cookie = established.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
    const csrf = /(?:^|; )quantos_csrf=([^;]+)/.exec(cookie)?.[1];
    assert(csrf, 'BFF did not issue its CSRF cookie');
    assert(cookie?.startsWith('quantos_session='), 'BFF did not issue its opaque cookie');
    runtime = start('runtime-gateway', runtimePort, {
      QUANTOS_RUNTIME_BIND: `127.0.0.1:${runtimePort}`,
      // Authorized for this isolated smoke only; never persist this key as Runtime configuration.
      QUANTOS_RUNTIME_STORAGE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    diagnosticPhase = 'runtime-startup';
    await ready(runtime, '/healthz', 204);
    const runPath = `/v1/runtime/runs/${crypto.randomUUID()}`;
    const request = (route, options = {}) => fetch(`${runtime.base}${route}`, {
      ...options, signal: AbortSignal.timeout(httpTimeoutMs),
    });
    diagnosticPhase = 'runtime-missing-cookie';
    const missing = await request(runPath);
    assert(missing.status === 401, 'Runtime accepted a missing BFF cookie');
    diagnosticPhase = 'runtime-authenticated-read';
    const authorized = await request(runPath, { headers: { cookie } });
    assert(authorized.status === 404, 'Runtime did not load the BFF identity before hiding an unknown run');
    diagnosticPhase = 'runtime-origin-denial';
    const wrongOrigin = await request('/v1/runtime/sessions', {
      method: 'POST', headers: { cookie, origin: 'https://other.invalid' },
    });
    assert(wrongOrigin.status === 403, 'Runtime accepted a foreign Origin');
    diagnosticPhase = 'runtime-role-denial';
    const deniedRole = await request('/v1/runtime/tools', {
      method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' },
      body: JSON.stringify({ tool_name: 'runtime.fixture', capability: 'research.write',
        description: 'denial probe', max_cost_units: 1, rate_limit_per_minute: 1, enabled: true }),
    });
    assert(deniedRole.status === 403, 'non-owner Runtime identity registered a tool');
    diagnosticPhase = 'bff-logout';
    const logout = await fetch(`${bff.base}/v1/auth/logout`, {
      method: 'POST', headers: { origin, cookie, 'x-csrf-token': csrf }, signal: AbortSignal.timeout(httpTimeoutMs),
    });
    assert(logout.status === 204, 'BFF logout failed');
    diagnosticPhase = 'runtime-revocation-read';
    const revoked = await request(runPath, { headers: { cookie } });
    assert(revoked.status === 401, 'Runtime accepted a revoked BFF cookie');
    console.log(JSON.stringify({ status: 'PASS', httpTimeoutMs, handshakeElapsedMs, target: 'isolated_supabase_local_runtime',
      realSupabaseAuth: true, independentBffAndRuntimeLogins: true,
      temporaryAdminStorageKey: true, storageOperationPerformed: false,
      startupPhases: runtime.startupPhases(),
      startupReadiness: { bff: bff.readiness, runtime: runtime.readiness },
      originKind: 'synthetic_https_server_probe',
      httpStatuses: { missingCookie: missing.status, authorizedUnknownRun: authorized.status,
        foreignOrigin: wrongOrigin.status, deniedRole: deniedRole.status,
        bffLogout: logout.status, revokedCookie: revoked.status } }));
  } finally {
    runtime?.child.kill('SIGTERM');
    bff.child.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error(`F06 Runtime live smoke failed [${diagnosticPhase}]: ${error.message}`);
  process.exitCode = 1;
});
