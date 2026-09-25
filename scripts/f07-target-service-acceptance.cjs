const { spawn, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/f07/target-service.json');
const origin = 'https://f07-isolated-target.invalid';
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
const receipt = { schema: 'quantos-f07-target-service/v1', sourceCommit, dirty,
  targetClass: 'isolated-supabase-local-service', status: 'RUNNING', checks: [],
  startedAt: new Date().toISOString() };
fs.mkdirSync(path.dirname(output), { recursive: true });
const save = () => fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
const assert = (value, message) => { if (!value) throw Error(message); };
const redact = value => String(value)
  .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
  .replace(/(?:sb_secret_|eyJ)[A-Za-z0-9_.-]+/g, '[redacted credential]');

function target() {
  assert(process.env.QUANTOS_F07_ISOLATED_PROJECT === '1', 'isolated project confirmation is required');
  assert(process.env.QUANTOS_F07_ALLOW_TEMP_ADMIN_STORAGE_KEY === '1',
    'temporary admin Storage key authorization is required');
  for (const name of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'QUANTOS_BFF_DATABASE_URL', 'QUANTOS_RUNTIME_DATABASE_URL',
    'QUANTOS_BFF_SSLROOTCERT']) assert(process.env[name], `${name} is required`);
  const api = new URL(process.env.SUPABASE_URL);
  assert(api.protocol === 'https:' && api.hostname.endsWith('.supabase.co'),
    'target must be a Supabase HTTPS project');
  const ref = api.hostname.split('.')[0];
  for (const name of ['DATABASE_URL', 'QUANTOS_BFF_DATABASE_URL', 'QUANTOS_RUNTIME_DATABASE_URL']) {
    const url = new URL(process.env[name]);
    const dbRef = url.hostname.startsWith('db.') ? url.hostname.split('.')[1]
      : decodeURIComponent(url.username).split('.').at(-1);
    assert(dbRef === ref, `${name} does not match the isolated Supabase project`);
    if (name !== 'DATABASE_URL') {
      assert(url.searchParams.get('sslmode') === 'verify-full', `${name} needs verify-full TLS`);
      const ca = url.searchParams.get('sslrootcert');
      assert(ca && fs.existsSync(ca), `${name} needs an existing CA file`);
    }
  }
  receipt.targetProjectRefHash = crypto.createHash('sha256').update(ref).digest('hex').slice(0, 16);
  receipt.storageCredentialScope = 'temporary-admin-key';
  return api;
}

function adminClient() {
  const url = new URL(process.env.DATABASE_URL);
  return new Client({ host: url.hostname, port: Number(url.port || 5432),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: url.pathname.slice(1) || 'postgres',
    ssl: { ca: fs.readFileSync(process.env.QUANTOS_BFF_SSLROOTCERT, 'utf8'),
      rejectUnauthorized: true }, connectionTimeoutMillis: 10000 });
}

async function authRequest(api, route, method, body, key) {
  const response = await fetch(new URL(route, api), {
    method, headers: { apikey: key, authorization: `Bearer ${key}`,
      'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  assert(response.ok, `Supabase Auth ${route} returned HTTP ${response.status}`);
  return data;
}

function start(binary, port, extra) {
  const child = spawn(path.resolve(root, `target/debug/${binary}`), [], {
    cwd: root, env: { ...process.env, ...extra, QUANTOS_TERMINAL_ORIGIN: origin },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostic = '';
  child.stdout.on('data', () => {});
  child.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk.toString()).slice(-3000); });
  return { child, base: `http://127.0.0.1:${port}`,
    diagnostic: () => redact(diagnostic).slice(0, 1500) };
}

async function ready(service, route, status) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (service.child.exitCode !== null) break;
    try {
      const response = await fetch(`${service.base}${route}`, { signal: AbortSignal.timeout(1000) });
      if (response.status === status) return;
    } catch { /* server is starting */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw Error(`${route} not ready (exit=${service.child.exitCode}; ${service.diagnostic()})`);
}

async function request(base, route, cookie, method = 'GET', body) {
  return fetch(`${base}${route}`, { method,
    headers: { ...(cookie ? { cookie } : {}), ...(method === 'POST' ? { origin } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
}

async function seed(db, userId) {
  const tenantId = crypto.randomUUID();
  const slug = `f07-target-${tenantId}`;
  await db.query('insert into quantos.tenants (id,slug,name) values ($1,$2,$2)', [tenantId, slug]);
  const workspaceId = (await db.query(`insert into quantos.workspaces
    (tenant_id,slug,name,is_primary) values ($1,'primary','Primary workspace',true) returning id`,
  [tenantId])).rows[0].id;
  const accountId = (await db.query(`insert into quantos.accounts
    (tenant_id,workspace_id,venue,external_account_ref,name,mode)
    values ($1,$2,'binance','paper-main','Paper account','paper') returning id`,
  [tenantId, workspaceId])).rows[0].id;
  await db.query(`insert into quantos.tenant_memberships
    (tenant_id,user_id,role) values ($1,$2,'owner')`, [tenantId, userId]);
  const actorId = (await db.query(`insert into quantos.actors
    (tenant_id,user_id,actor_kind,display_name)
    values ($1,$2,'user','F07 target owner') returning id`, [tenantId, userId])).rows[0].id;
  await db.query(`insert into quantos.workspace_memberships
    (tenant_id,workspace_id,actor_id,role) values ($1,$2,$3,'owner')`,
  [tenantId, workspaceId, actorId]);
  await db.query(`insert into quantos.actor_capabilities
    (tenant_id,actor_id,workspace_id,account_id,capability,mode_scope)
    values ($1,$2,$3,$4,'research.write','paper')`,
  [tenantId, actorId, workspaceId, accountId]);
  return tenantId;
}

async function main() {
  const api = target();
  const db = adminClient();
  await db.connect();
  let tenantId;
  let bff;
  let runtime;
  let cookie;
  let otherCookie;
  try {
    const bucket = (await db.query(`select exists(
      select 1 from storage.buckets where id='quantos-artifacts' and public=false
    ) as private_bucket`)).rows[0];
    assert(bucket.private_bucket, 'private quantos-artifacts Storage bucket is required');
    receipt.checks.push('private Artifact Storage bucket exists');
    const email = `f07-target-${crypto.randomUUID()}@example.com`;
    const password = crypto.randomBytes(32).toString('base64url');
    const created = await authRequest(api, '/auth/v1/admin/users', 'POST',
      { email, password, email_confirm: true }, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const userId = created.id || created.user?.id;
    assert(userId, 'Supabase Auth did not create a test identity');
    tenantId = await seed(db, userId);
    receipt.checks.push('real Supabase Auth identity and isolated owner/capability fixture');
    const token = (await authRequest(api, '/auth/v1/token?grant_type=password', 'POST',
      { email, password }, process.env.SUPABASE_PUBLISHABLE_KEY)).access_token;
    assert(token, 'Supabase login returned no access token');
    const bffPort = 52000 + crypto.randomInt(1000);
    const runtimePort = 53000 + crypto.randomInt(1000);
    bff = start('bff-gateway', bffPort, { QUANTOS_BFF_MODE: 'live',
      QUANTOS_BFF_BIND: `127.0.0.1:${bffPort}`, QUANTOS_BFF_ENVIRONMENT: 'dev' });
    await ready(bff, '/v1/session', 401);
    const established = await fetch(`${bff.base}/v1/auth/session`, { method: 'POST',
      headers: { origin, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    assert(established.status === 204, `BFF session returned HTTP ${established.status}`);
    cookie = established.headers.get('set-cookie')?.split(';')[0];
    assert(cookie?.startsWith('quantos_session='), 'BFF did not issue an opaque cookie');
    receipt.checks.push('real Supabase login and BFF opaque session');
    runtime = start('runtime-gateway', runtimePort, {
      QUANTOS_RUNTIME_BIND: `127.0.0.1:${runtimePort}`,
      QUANTOS_RUNTIME_STORAGE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    await ready(runtime, '/healthz', 204);
    const tool = { tool_name: 'runtime.fixture', capability: 'research.write',
      description: 'F07 target fixture', max_cost_units: 100,
      rate_limit_per_minute: 100, enabled: true };
    const registered = await request(runtime.base, '/v1/runtime/tools', cookie, 'POST', tool);
    assert(registered.status === 200, `tool registration returned HTTP ${registered.status}`);
    const session = await request(runtime.base, '/v1/runtime/sessions', cookie, 'POST');
    assert(session.status === 201, `Runtime session returned HTTP ${session.status}`);
    const sessionId = (await session.json()).runtime_session_id;
    const input = { runtime_session_id: sessionId, tool_name: 'runtime.fixture',
      capability: 'research.write', workflow_kind: 'runtime.fixture.v1',
      idempotency_key: `f07-target-${crypto.randomUUID()}`, correlation_id: crypto.randomUUID(),
      input_hash: `sha256:${crypto.createHash('sha256').update('f07-target-input').digest('hex')}`,
      max_attempts: 3, deadline_at: new Date(Date.now() + 600000).toISOString(),
      cost_budget_units: 10, rate_limit_per_minute: 100 };
    const scheduled = await request(runtime.base, '/v1/runtime/runs', cookie, 'POST', input);
    assert(scheduled.status === 202, `Runtime schedule returned HTTP ${scheduled.status}`);
    const runId = (await scheduled.json()).workflow_run_id;
    let finalRun;
    for (let attempt = 0; attempt < 60; attempt++) {
      const response = await request(runtime.base, `/v1/runtime/runs/${runId}`, cookie);
      assert(response.status === 200, `Runtime read returned HTTP ${response.status}`);
      finalRun = await response.json();
      if (['succeeded', 'failed', 'cancelled', 'timed_out'].includes(finalRun.status)) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(finalRun.status === 'succeeded', `Runtime run ended as ${finalRun.status}`);
    const rows = (await db.query(`select artifact.artifact_id, artifact.content_hash
      from quantos.workflow_run_artifacts binding
      join quantos.object_artifacts artifact on artifact.artifact_id=binding.artifact_id
      where binding.tenant_id=$1 and binding.workflow_run_id=$2`, [tenantId, runId])).rows;
    assert(rows.length === 1, 'Runtime did not persist exactly one Artifact binding');
    const artifact = await request(runtime.base,
      `/v1/runtime/runs/${runId}/artifacts/${rows[0].artifact_id}`, cookie);
    assert(artifact.status === 200, `Artifact retrieval returned HTTP ${artifact.status}`);
    const bytes = Buffer.from(await artifact.arrayBuffer());
    assert(`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}` === rows[0].content_hash,
      'retrieved Artifact hash differs from the target manifest');
    const missing = await request(runtime.base, `/v1/runtime/runs/${runId}`);
    assert(missing.status === 401, 'Runtime accepted missing BFF cookie');
    if (process.env.QUANTOS_F06_TEST_EMAIL && process.env.QUANTOS_F06_TEST_PASSWORD) {
      const otherToken = (await authRequest(api, '/auth/v1/token?grant_type=password', 'POST',
        { email: process.env.QUANTOS_F06_TEST_EMAIL,
          password: process.env.QUANTOS_F06_TEST_PASSWORD },
        process.env.SUPABASE_PUBLISHABLE_KEY)).access_token;
      assert(otherToken, 'separate tenant login returned no token');
      const otherSession = await fetch(`${bff.base}/v1/auth/session`, { method: 'POST',
        headers: { origin, authorization: `Bearer ${otherToken}` },
        signal: AbortSignal.timeout(15000) });
      assert(otherSession.status === 204, `separate tenant BFF session returned HTTP ${otherSession.status}`);
      otherCookie = otherSession.headers.get('set-cookie')?.split(';')[0];
      assert(otherCookie?.startsWith('quantos_session='), 'separate tenant BFF cookie is missing');
      const deniedRun = await request(runtime.base, `/v1/runtime/runs/${runId}`, otherCookie);
      const deniedCancel = await request(runtime.base, `/v1/runtime/runs/${runId}/cancel`,
        otherCookie, 'POST');
      const deniedArtifact = await request(runtime.base,
        `/v1/runtime/runs/${runId}/artifacts/${rows[0].artifact_id}`, otherCookie);
      assert(deniedRun.status === 404 && deniedCancel.status === 404 && deniedArtifact.status === 404,
        'separate tenant could observe or mutate another tenant Runtime resource');
      receipt.checks.push('separate real Auth tenant denied run, cancellation and Artifact access');
    }
    receipt.checks.push('dedicated BFF/Runtime logins, strict TLS, HTTP schedule/worker/Storage/retrieval/hash, missing-cookie rejection');
    const logout = await request(bff.base, '/v1/auth/logout', cookie, 'POST');
    assert(logout.status === 204, `BFF logout returned HTTP ${logout.status}`);
    const revoked = await request(runtime.base, `/v1/runtime/runs/${runId}`, cookie);
    assert(revoked.status === 401, 'Runtime accepted a revoked BFF session');
    cookie = undefined;
    receipt.checks.push('BFF logout revokes Runtime access');
    receipt.runId = runId;
    receipt.artifactId = rows[0].artifact_id;
    receipt.status = 'DIAGNOSTIC_ONLY';
  } finally {
    if (otherCookie && bff) {
      await request(bff.base, '/v1/auth/logout', otherCookie, 'POST').catch(() => {});
    }
    if (cookie && bff) {
      await request(bff.base, '/v1/auth/logout', cookie, 'POST').catch(() => {});
    }
    runtime?.child.kill('SIGTERM');
    bff?.child.kill('SIGTERM');
    if (tenantId) {
      await db.query(`update quantos.workflow_runs set status='failed', completed_at=now(),
        lease_owner=null, lease_expires_at=null, attempt_id=null,
        last_error='F07 target fixture retired', updated_at=now()
        where tenant_id=$1 and status in ('queued','running','cancel_requested')`, [tenantId]);
      await db.query(`update quantos.tool_registry set enabled=false, updated_at=now()
        where tenant_id=$1 and enabled=true`, [tenantId]);
    }
    await db.end();
  }
}

save();
main().catch(error => { receipt.status = 'FAIL'; receipt.error = redact(error.message);
  process.exitCode = 1; console.error(`F07 target acceptance failed: ${redact(error.message)}`); })
  .finally(() => { receipt.completedAt = new Date().toISOString(); save(); });
