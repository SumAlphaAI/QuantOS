// Owned loopback reference host only; no database, IdP, Vault or exchange I/O.
import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID, createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import process from 'node:process';
import {operations as specs, validateRequest, validateResponse} from '../tests/contract/http-contract.mjs';
import {environment} from './a1-functional-scope.mjs';
import {assistedOperations, assistedScope, assistedCoverage} from './provider-all-assisted-coverage.mjs';

const output = process.argv[2]; assert(output && process.argv.length === 3);
const {Request, fetch, URL, setTimeout, clearTimeout} = globalThis;
const digest = v => createHash('sha256').update(v).digest('hex');
const records = [], defaultOff = {};
let child, base, profile, requestId = '00000000-0000-4000-8000-000000000001', workflow, failure = null;
const csrf = 'csrf-token-0000000000000001';
async function close() {
  if (child && child.exitCode === null) { child.kill(); await new Promise(r => child.once('close', r)); }
  child = undefined;
}
async function start(name) {
  await close(); profile = name;
  const reserve = createServer(); await new Promise(r => reserve.listen(0, '127.0.0.1', r));
  const {port} = reserve.address(); await new Promise(r => reserve.close(r)); base = `http://127.0.0.1:${port}`;
  child = spawn(resolve('target/debug/bff-gateway'), [], {env: {...environment(), QUANTOS_BFF_MODE: 'reference', QUANTOS_BFF_BIND: `127.0.0.1:${port}`, QUANTOS_BFF_REFERENCE_CONTEXT: name === 'paper-off' ? 'paper' : 'assisted-local', QUANTOS_BFF_OWNED_ASSISTED: name === 'assisted-on' ? 'enabled' : 'off'}, stdio: ['ignore', 'pipe', 'pipe']});
  child.stderr.on('data', () => {});
  await new Promise((r, j) => {
    const timer = setTimeout(() => j(Error('owned reference startup timeout')), 30000);
    child.once('error', e => { clearTimeout(timer); j(e); });
    child.once('exit', () => { clearTimeout(timer); j(Error('owned reference exited')); });
    child.stdout.on('data', b => { if (String(b).includes('"ready":true')) { clearTimeout(timer); r(); } });
  });
}
async function call(id, {body, session = 'session-current', status = 200, control = 'success', key = randomUUID(), recovery, badCsrf = false} = {}) {
  const op = specs.get(id), params = {requestId};
  const path = op.path.replace(/\{([^}]+)\}/g, (_, k) => params[k]);
  const bytes = body === undefined ? undefined : JSON.stringify(body);
  const headers = {cookie: `quantos_session=${session}; quantos_csrf=${csrf}`, origin: 'http://localhost:3190', 'x-csrf-token': badCsrf ? 'wrong' : csrf, 'x-request-id': randomUUID(), 'idempotency-key': key, ...(bytes === undefined ? {} : {'content-type': 'application/json'})};
  const req = new Request(new URL(path, base), {method: op.method, headers, ...(bytes === undefined ? {} : {body: bytes})});
  const requestIssues = (await validateRequest(id, req.clone(), params)).issues;
  if (!badCsrf) assert.deepEqual(requestIssues, [], id + ' request');
  const res = await fetch(req), issues = await validateResponse(id, res.clone());
  const text = await res.text();
  records.push({operationId: id, profile, control, ...(recovery ? {recovery} : {}), method: req.method, path, status: res.status, requestValidation: requestIssues.length ? 'EXPECTED_REJECTION' : 'PASS', responseValidation: issues.length ? 'FAIL' : 'PASS', issues, bodyDigest: digest(bytes ?? ''), idempotencyDigest: digest(key), csrfDigest: digest(headers['x-csrf-token']), responseDigest: digest(text)});
  assert.deepEqual(issues, [], id + ' response'); assert.equal(res.status, status, id + ' ' + text);
  return text ? JSON.parse(text) : null;
}
async function proof(session) {
  const m = await call('mfaChallenge', {session, body: {purpose: 'security_change', code: '123456'}});
  const r = await call('reauth', {session, body: {challengeRef: m.challengeRef}});
  return {mfaChallengeRef: m.challengeRef, reauthTokenRef: r.reauthTokenRef};
}
const placeholder = id => id === 'openAssistedRequest' ? {subjectId: requestId} : id === 'approveAssistedRequest' ? {expectedRevision: 0, mfaChallengeRef: 'owned-placeholder', reauthTokenRef: 'owned-placeholder'} : id === 'submitAssistedRequest' ? {expectedRevision: 2} : undefined;
try {
  for (const mode of ['paper-off', 'assisted-off']) {
    await start(mode);
    for (const id of assistedOperations) {
      const c = await call(id, {body: placeholder(id), status: id === 'getAssistedNativeCapabilities' ? 200 : 403, control: 'default-off'});
      if (id === 'getAssistedNativeCapabilities') defaultOff[mode] = c;
    }
  }
  await start('assisted-on');
  const caps = await call('getAssistedNativeCapabilities'); assert.equal(caps.executionAuthority, false); assert.equal(caps.serverFlagEnabled, true);
  const subject = (await call('listAssistedSubjects')).items[0];
  await call('openAssistedRequest', {body: {subjectId: subject.subjectId}, badCsrf: true, status: 403, control: 'csrf'});
  const key = randomUUID(), body = {subjectId: subject.subjectId};
  const opened = await call('openAssistedRequest', {body, key, recovery: 'openAssistedRequest'}); requestId = opened.request.requestId;
  assert.deepEqual(await call('openAssistedRequest', {body, key, recovery: 'openAssistedRequest'}), opened);
  await call('listAssistedRequests'); await call('getAssistedRequest');
  await call('approveAssistedRequest', {body: {expectedRevision: 0, ...await proof('session-current')}, status: 403, control: 'self-approval'});
  for (const [revision, session] of ['session-approver', 'session-owner'].entries()) {
    const body = {expectedRevision: revision, ...await proof(session)}, key = randomUUID();
    const row = await call('approveAssistedRequest', {session, body, key, ...(revision === 0 ? {recovery: 'approveAssistedRequest'} : {})});
    if (revision === 0) assert.deepEqual(await call('approveAssistedRequest', {session, body, key, recovery: 'approveAssistedRequest'}), row);
  }
  const commandBody = {expectedRevision: 2}, commandKey = randomUUID();
  const command = await call('submitAssistedRequest', {body: commandBody, key: commandKey, recovery: 'submitAssistedRequest'});
  assert.deepEqual(await call('submitAssistedRequest', {body: commandBody, key: commandKey, recovery: 'submitAssistedRequest'}), command);
  const audit = await call('getAssistedApprovalAudit'); workflow = {subject, requestId, command, audit};
  for (const id of assistedOperations) {
    await call(id, {body: placeholder(id), session: 'missing', status: 401, control: 'missing-session'});
    if (id !== 'getAssistedNativeCapabilities') await call(id, {body: placeholder(id), session: 'session-viewer', status: 403, control: 'viewer'});
  }
} catch (e) { failure = e.message; } finally { await close(); }
const report = {schema: 'quantos-provider-all-assisted-http/v1', status: failure ? 'FAIL' : 'PASS', failure, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(), binarySha256: digest(readFileSync('target/debug/bff-gateway')), scope: assistedScope, operations: assistedOperations, records, defaultOff, workflow, databaseExecution: false, externalExecution: false, productionCredentialsUsed: false, formalAccepted: false};
if (!failure) { try { assistedCoverage(report); } catch (e) { report.failure = e.message; report.status = 'FAIL'; } }
mkdirSync(dirname(output), {recursive: true}); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify({status: report.status, operations: assistedOperations.length, records: records.length, failure: report.failure}) + '\n');
if (report.status !== 'PASS') process.exitCode = 1;
