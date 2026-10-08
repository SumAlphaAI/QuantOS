const {connectBeforeStatements}=require('./lib/postgres-bootstrap.cjs');
const { runAuthLoginAttempts } = require('./lib/auth-login-retry.cjs');
const ready = require('./lib/service-readiness.cjs');
const observeClientErrors = require('./lib/target-client-errors.cjs');
const startupEvidence = require('./lib/runtime-startup-evidence.cjs');
const { spawn, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const traceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'quantos-f07-traces-'));
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/f07/target-service.json');
const origin = 'https://f07-isolated-target.invalid';
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
const configuredDevelopment = process.env.QUANTOS_F07_TARGET_MODE === 'configured-development';
const receipt = { schema: 'quantos-f07-target-service/v1', sourceCommit, dirty,
  targetClass: configuredDevelopment ? 'configured-supabase-local-service-development' : 'isolated-supabase-local-service', formalAccepted: false, status: 'RUNNING', checks: [],
  startedAt: new Date().toISOString(), phase: 'validate-target', authLoginRequests: [] };
fs.mkdirSync(path.dirname(output), { recursive: true });
const save = () => fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
const assert = (value, message) => { if (!value) throw Error(message); };
const redact = value => String(value)
  .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
  .replace(/(?:sb_secret_|eyJ)[A-Za-z0-9_.-]+/g, '[redacted credential]');

function target() {
  assert(configuredDevelopment || process.env.QUANTOS_F07_ISOLATED_PROJECT === '1', 'explicit configured-development mode or isolated project confirmation is required');
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
  const login = route === '/auth/v1/token?grant_type=password';
  const execute = async () => {
    const response = await fetch(new URL(route, api), {
      method, headers: { apikey: key, authorization: `Bearer ${key}`,
        'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => ({}));
    assert(response.ok, `Supabase Auth ${route} returned HTTP ${response.status}`);
    if (login) assert(data.access_token, 'Supabase login returned no access token');
    return data;
  };
  if (!login) return execute();
  const request = { id: receipt.authLoginRequests.length + 1, route, timeoutMs: 15000, maxAttempts: 3, attempts: [] };
  receipt.authLoginRequests.push(request);
  save();
  return runAuthLoginAttempts(execute, { onAttempt: attempt => {
    request.attempts.push(attempt); save();
  } });
}

async function stopService(service) {
  if (!service) return null;
  const child = service.child;
  if (child.exitCode !== null || child.signalCode !== null) return child.pid;
  await new Promise((resolve, reject) => {
    let grace, limit;
    const done = error => {
      clearTimeout(grace); clearTimeout(limit);
      child.off('exit', exited);
      error ? reject(error) : resolve();
    };
    const exited = () => done();
    child.once('exit', exited);
    child.kill('SIGTERM');
    grace = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 3000);
    limit = setTimeout(() => done(Error('owned service did not stop after SIGKILL')), 6000);
  });
  return child.pid;
}

function start(binary, port, extra) {
  const child = spawn(path.resolve(root, `target/debug/${binary}`), [], {
    cwd: root, env: { ...process.env, ...extra, QUANTOS_TERMINAL_ORIGIN: origin,
      QUANTOS_TRACE_EXPORT_PATH: path.join(traceDirectory, `${binary}.jsonl`) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostic = '';
  child.stdout.on('data', () => {});
  child.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk.toString()).slice(-6000); });
  return { child, base: `http://127.0.0.1:${port}`,
    startupPhases: () => startupEvidence(diagnostic),
    diagnostic: () => redact(diagnostic).slice(-6000) };
}

async function request(base, route, cookie, method = 'GET', body) {
  const csrf = /(?:^|; )quantos_csrf=([^;]+)/.exec(cookie ?? '')?.[1];
  return fetch(`${base}${route}`, { method,
    headers: { ...(cookie ? { cookie } : {}), ...(method === 'POST' ? { origin, ...(csrf ? { 'x-csrf-token': csrf } : {}) } : {}),
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
  receipt.fixture = { tenantId, actorId };
  save();
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
  let db;
  let assertDatabaseHealthy = () => {};
  let tenantId;
  let bff;
  let runtime;
  let cookie;
  let otherCookie;
  try {
    receipt.phase = 'database-connect'; save();
    receipt.bootstrapConnection = {};
    db = await connectBeforeStatements(adminClient, {record:receipt.bootstrapConnection,onAttempt:save});
    assertDatabaseHealthy = observeClientErrors(db, () => {
      receipt.status = 'FAIL';
      receipt.databaseError = 'Target database connection failed outside a query';
      save();
    });
    const bucket = (await db.query(`select exists(
      select 1 from storage.buckets where id='quantos-artifacts' and public=false
    ) as private_bucket`)).rows[0];
    assert(bucket.private_bucket, 'private quantos-artifacts Storage bucket is required');
    receipt.checks.push('private Artifact Storage bucket exists');
    const email = `f07-target-${crypto.randomUUID()}@example.com`;
    const password = crypto.randomBytes(32).toString('base64url');
    receipt.phase = 'auth-create-fixture'; save();
    const created = await authRequest(api, '/auth/v1/admin/users', 'POST',
      { email, password, email_confirm: true }, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const userId = created.id || created.user?.id;
    assert(userId, 'Supabase Auth did not create a test identity');
    receipt.phase = 'database-seed-fixture'; save();
    tenantId = await seed(db, userId);
    receipt.checks.push('real Supabase Auth identity and isolated owner/capability fixture');
    receipt.phase = 'auth-login-owner'; save();
    const token = (await authRequest(api, '/auth/v1/token?grant_type=password', 'POST',
      { email, password }, process.env.SUPABASE_PUBLISHABLE_KEY)).access_token;
    assert(token, 'Supabase login returned no access token');
    const bffPort = 52000 + crypto.randomInt(1000);
    const runtimePort = 53000 + crypto.randomInt(1000);
    receipt.phase = 'bff-startup-session'; save();
    bff = start('bff-gateway', bffPort, { QUANTOS_BFF_MODE: 'live',
      QUANTOS_BFF_BIND: `127.0.0.1:${bffPort}`, QUANTOS_BFF_ENVIRONMENT: 'dev' });
    await ready(bff, '/v1/session', 401);
    const established = await fetch(`${bff.base}/v1/auth/session`, { method: 'POST',
      headers: { origin, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    assert(established.status === 204, `BFF session returned HTTP ${established.status}`);
    cookie = established.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    assert(cookie?.startsWith('quantos_session=') && /(?:^|; )quantos_csrf=/.test(cookie), 'BFF did not issue opaque session and CSRF cookies');
    receipt.checks.push('real Supabase login and BFF opaque session');
    receipt.phase = 'runtime-startup'; save();
    runtime = start('runtime-gateway', runtimePort, {
      QUANTOS_RUNTIME_BIND: `127.0.0.1:${runtimePort}`,
      QUANTOS_RUNTIME_STORAGE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    await ready(runtime, '/healthz', 204);
    receipt.startupPhases = runtime.startupPhases();
    receipt.startupReadiness = { bff: bff.readiness, runtime: runtime.readiness };
    receipt.phase = 'runtime-functional-http'; save();
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
      receipt.phase = 'auth-login-separate-tenant'; save();
      const otherToken = (await authRequest(api, '/auth/v1/token?grant_type=password', 'POST',
        { email: process.env.QUANTOS_F06_TEST_EMAIL,
          password: process.env.QUANTOS_F06_TEST_PASSWORD },
        process.env.SUPABASE_PUBLISHABLE_KEY)).access_token;
      assert(otherToken, 'separate tenant login returned no token');
      const otherSession = await fetch(`${bff.base}/v1/auth/session`, { method: 'POST',
        headers: { origin, authorization: `Bearer ${otherToken}` },
        signal: AbortSignal.timeout(15000) });
      assert(otherSession.status === 204, `separate tenant BFF session returned HTTP ${otherSession.status}`);
      otherCookie = otherSession.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
      assert(otherCookie?.startsWith('quantos_session=') && /(?:^|; )quantos_csrf=/.test(otherCookie), 'separate tenant BFF session and CSRF cookies are missing');
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
    receipt.phase = 'session-revocation'; save();
    const missingCsrf = await fetch(`${bff.base}/v1/auth/logout`, { method: 'POST',
      headers: { origin, cookie }, signal: AbortSignal.timeout(15000) });
    assert(missingCsrf.status === 403, 'BFF logout accepted missing CSRF token');
    const logout = await request(bff.base, '/v1/auth/logout', cookie, 'POST');
    assert(logout.status === 204, `BFF logout returned HTTP ${logout.status}`);
    const revoked = await request(runtime.base, `/v1/runtime/runs/${runId}`, cookie);
    assert(revoked.status === 401, 'Runtime accepted a revoked BFF session');
    cookie = undefined;
    receipt.checks.push('BFF logout revokes Runtime access; missing CSRF rejected');
    receipt.runId = runId;
    receipt.artifactId = rows[0].artifact_id;
    assertDatabaseHealthy();
    receipt.status = 'DIAGNOSTIC_ONLY';
    receipt.engineeringStatus = 'PASS';
    receipt.excluded = ['deployed HTTPS', 'restricted Runtime Storage credential', 'scheduling P95', 'hosted CI'];
  } catch (error) {
    receipt.failurePhase = receipt.phase;
    receipt.primaryError = redact(error.message);
    receipt.serviceDiagnostics = { bff: bff?.diagnostic(), runtime: runtime?.diagnostic() };
    throw error;
  } finally {
    receipt.phase = 'owned-fixture-cleanup'; save();
    const cleanup = { status: 'RUNNING', metadata: 'RETAINED', startedServices: [bff, runtime].filter(Boolean).length,
      stoppedPids: [], sessionRetirements: [], failures: [] };
    receipt.fixtureCleanup = cleanup;
    for (const [kind, sessionCookie] of [['separate', otherCookie], ['owner', cookie]]) {
      if (sessionCookie && bff) {
        try {
          const response = await request(bff.base, '/v1/auth/logout', sessionCookie, 'POST');
          cleanup.sessionRetirements.push({ kind, status: response.status });
          assert([204, 401].includes(response.status), `${kind} fixture session retirement unconfirmed`);
        } catch (error) { cleanup.failures.push(redact(error.message)); }
      }
    }
    const stopped = await Promise.allSettled([stopService(bff), stopService(runtime)]);
    for (const result of stopped) {
      if (result.status === 'fulfilled' && result.value) cleanup.stoppedPids.push(result.value);
      if (result.status === 'rejected') cleanup.failures.push(redact(result.reason.message));
    }
    try {
      const fixture = receipt.fixture;
      if (fixture) {
        const actor = (await db.query(`update quantos.actors set is_active=false
          where id=$1 and tenant_id=$2 returning id,tenant_id,is_active`, [fixture.actorId, fixture.tenantId])).rows;
        assert(actor.length === 1 && actor[0].is_active === false, 'owned F07 actor was not deactivated');
        cleanup.actor = actor[0];
      }
      const ownedTenant = tenantId ?? fixture?.tenantId;
      if (ownedTenant) {
        await db.query(`update quantos.workflow_runs set status='failed', completed_at=now(),
          lease_owner=null, lease_expires_at=null, attempt_id=null,
          last_error='F07 target fixture retired', updated_at=now()
          where tenant_id=$1 and status in ('queued','running','cancel_requested')`, [ownedTenant]);
        await db.query(`update quantos.tool_registry set enabled=false, updated_at=now()
          where tenant_id=$1 and enabled=true`, [ownedTenant]);
      }
    } catch (error) { cleanup.failures.push(redact(error.message)); }
    finally {
      try { if (db) await db.end(); } catch (error) { cleanup.failures.push(redact(error.message)); }
    }
    cleanup.completedAt = new Date().toISOString();
    cleanup.status = cleanup.failures.length === 0 ? 'PASS' : 'FAIL';
    save();
    if (cleanup.status !== 'PASS') throw Error('owned F07 fixture cleanup failed');
    assertDatabaseHealthy();
  }
}

save();
main().catch(error => { receipt.status = 'FAIL'; receipt.error = redact(error.message);
  process.exitCode = 1; console.error(`F07 target acceptance failed: ${redact(error.message)}`); })
  .finally(() => { fs.rmSync(traceDirectory, { recursive: true, force: true }); receipt.completedAt = new Date().toISOString(); save(); });
