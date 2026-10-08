const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { main } = require('./f06-execution-command-smoke.cjs');
const { validateBootstrap } = require('./lib/postgres-bootstrap.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quantos-f06-command-unit-'));
const ca = path.join(directory, 'ca.pem');
fs.writeFileSync(ca, 'unit fixture CA; no network connection');
const environment = {
  QUANTOS_F06_ISOLATED_PROJECT: '1', QUANTOS_F06_TARGET_ISOLATED: '1',
  SUPABASE_URL: 'https://unit-fixture.supabase.co',
  DATABASE_URL: 'postgres://operator:private-unit-value@db.unit-fixture.supabase.co:5432/postgres',
  QUANTOS_EXECUTION_DATABASE_URL: 'postgres://execution:private-unit-value@db.unit-fixture.supabase.co:5432/postgres?sslmode=verify-full&sslrootcert=' + encodeURIComponent(ca),
};
const saved = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
test.before(() => Object.assign(process.env, environment));
test.after(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  fs.rmSync(directory, { recursive: true });
});
const closed = () => Error('Connection terminated unexpectedly');
function fixture(connectErrors, queryError) {
  const clients = [], logs = [], phase = { value: 'CONFIGURATION' };
  const createClient = options => {
    assert.equal(options.ssl.rejectUnauthorized, true);
    assert.equal(options.connectionTimeoutMillis, 10000);
    const index = clients.length;
    const client = {
      closed: false, queries: 0,
      async connect() { if (connectErrors[index]) throw connectErrors[index]; },
      async query() { this.queries++; throw queryError; },
      async end() { this.closed = true; },
    };
    clients.push(client);
    return client;
  };
  return { clients, logs, phase, options: { createClient, phase,
    pause: async () => {}, log: value => logs.push(JSON.parse(value)) } };
}
test('command entrypoint retains initial failure, then executes SQL once with verified TLS', async () => {
  const denied = Object.assign(Error('permission denied'), { code: '42501' });
  const f = fixture([closed()], denied);
  await assert.rejects(main(f.options), error => error === denied && error.f06Phase === 'SQL_PREFLIGHT');
  assert.equal(f.clients.length, 2);
  assert(f.clients.every(client => client.closed));
  assert.deepEqual(f.clients.map(client => client.queries), [0, 1]);
  const records = f.logs.filter(log => log.event === 'F06_COMMAND_BOOTSTRAP');
  assert.equal(records[0].status, 'FAIL');
  validateBootstrap(records.at(-1));
  assert(!JSON.stringify(f.logs).includes('private-unit-value'));
});
test('transport closure after first SQL never reconnects or replays the statement', async () => {
  const error = closed(), f = fixture([], error);
  await assert.rejects(main(f.options), caught => caught === error && caught.f06Phase === 'SQL_PREFLIGHT');
  assert.equal(f.clients.length, 1);
  assert.equal(f.clients[0].queries, 1);
  assert.equal(f.clients[0].closed, true);
});
test('persistent initial closure fails after three closed clients without any SQL', async () => {
  const f = fixture([closed(), closed(), closed()]);
  await assert.rejects(main(f.options));
  assert.equal(f.phase.value, 'INITIAL_CONNECTION');
  assert.equal(f.clients.length, 3);
  assert(f.clients.every(client => client.closed && client.queries === 0));
  const records = f.logs.filter(log => log.event === 'F06_COMMAND_BOOTSTRAP');
  assert.equal(records.length, 3);
  assert.equal(records.at(-1).status, 'FAIL');
});
for (const [name, code] of [['authentication', '28P01'], ['permission', '42501'], ['TLS', 'CERT_HAS_EXPIRED']]) {
  test(name + ' initial failure is not retried', async () => {
    const error = Object.assign(Error('private-unit-value'), { code }), f = fixture([error]);
    await assert.rejects(main(f.options));
    assert.equal(f.clients.length, 1);
    assert.equal(f.clients[0].queries, 0);
    assert.equal(f.clients[0].closed, true);
    assert.equal(f.phase.value, 'INITIAL_CONNECTION');
    assert(!JSON.stringify(f.logs).includes(error.message));
  });
}
