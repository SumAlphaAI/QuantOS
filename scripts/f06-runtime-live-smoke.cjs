const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const assert = (condition, message) => { if (!condition) throw Error(message); };
const origin = 'https://f06-runtime-local-smoke.invalid';

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
  child.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk.toString('utf8')).slice(0, 2500); });
  return { child, base: `http://127.0.0.1:${port}`,
    diagnostic: () => diagnostic
      .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
      .replace(/(?:sb_secret_|eyJ)[A-Za-z0-9_.-]+/g, '[redacted credential]')
      .slice(0, 1400) };
}

async function ready(service, route, expected) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (service.child.exitCode !== null) break;
    try {
      const response = await fetch(`${service.base}${route}`, { signal: AbortSignal.timeout(1000) });
      if (response.status === expected) return;
    } catch { /* service has not started */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw Error(`${route} did not become ready (exit=${service.child.exitCode}; ${service.diagnostic()})`);
}

async function main() {
  for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'QUANTOS_BFF_DATABASE_URL', 'QUANTOS_RUNTIME_DATABASE_URL', 'QUANTOS_F06_TEST_EMAIL',
    'QUANTOS_F06_TEST_PASSWORD']) assert(process.env[name], `${name} is required`);
  await assertIsolatedIdleRuntime();
  const login = await fetch(new URL('/auth/v1/token?grant_type=password', process.env.SUPABASE_URL), {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: process.env.QUANTOS_F06_TEST_EMAIL,
      password: process.env.QUANTOS_F06_TEST_PASSWORD }),
    signal: AbortSignal.timeout(10000),
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
    await ready(bff, '/v1/session', 401);
    const established = await fetch(`${bff.base}/v1/auth/session`, {
      method: 'POST', headers: { origin, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    assert(established.status === 204, 'BFF did not establish the real Auth session');
    const cookie = established.headers.get('set-cookie')?.split(';')[0];
    assert(cookie?.startsWith('quantos_session='), 'BFF did not issue its opaque cookie');
    runtime = start('runtime-gateway', runtimePort, {
      QUANTOS_RUNTIME_BIND: `127.0.0.1:${runtimePort}`,
      // Authorized for this isolated smoke only; never persist this key as Runtime configuration.
      QUANTOS_RUNTIME_STORAGE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    await ready(runtime, '/healthz', 204);
    const runPath = `/v1/runtime/runs/${crypto.randomUUID()}`;
    const request = (route, options = {}) => fetch(`${runtime.base}${route}`, {
      ...options, signal: AbortSignal.timeout(15000),
    });
    const missing = await request(runPath);
    assert(missing.status === 401, 'Runtime accepted a missing BFF cookie');
    const authorized = await request(runPath, { headers: { cookie } });
    assert(authorized.status === 404, 'Runtime did not load the BFF identity before hiding an unknown run');
    const wrongOrigin = await request('/v1/runtime/sessions', {
      method: 'POST', headers: { cookie, origin: 'https://other.invalid' },
    });
    assert(wrongOrigin.status === 403, 'Runtime accepted a foreign Origin');
    const deniedRole = await request('/v1/runtime/tools', {
      method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' },
      body: JSON.stringify({ tool_name: 'runtime.fixture', capability: 'research.write',
        description: 'denial probe', max_cost_units: 1, rate_limit_per_minute: 1, enabled: true }),
    });
    assert(deniedRole.status === 403, 'non-owner Runtime identity registered a tool');
    const logout = await fetch(`${bff.base}/v1/auth/logout`, {
      method: 'POST', headers: { origin, cookie }, signal: AbortSignal.timeout(15000),
    });
    assert(logout.status === 204, 'BFF logout failed');
    const revoked = await request(runPath, { headers: { cookie } });
    assert(revoked.status === 401, 'Runtime accepted a revoked BFF cookie');
    console.log(JSON.stringify({ status: 'PASS', target: 'isolated_supabase_local_runtime',
      realSupabaseAuth: true, independentBffAndRuntimeLogins: true,
      temporaryAdminStorageKey: true, storageOperationPerformed: false,
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
  console.error(`F06 Runtime live smoke failed: ${error.message}`);
  process.exitCode = 1;
});
