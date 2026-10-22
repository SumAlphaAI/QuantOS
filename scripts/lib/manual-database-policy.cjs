const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

// Local maintenance always uses the latest file, even if the shell still exports
// credentials from a retired project. CI has no .env.local and uses its secrets.
function loadLocalDatabaseEnvironment(env = process.env, file = path.resolve(__dirname, '../../.env.local')) {
  if (!fs.existsSync(file)) return env;
  const values = parseEnv(fs.readFileSync(file, 'utf8'));
  for (const key of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'QUANTOS_BFF_SSLROOTCERT',
    'QUANTOS_BFF_DATABASE_URL', 'QUANTOS_RUNTIME_DATABASE_URL', 'QUANTOS_EXECUTION_DATABASE_URL', 'QUANTOS_RUNTIME_STORAGE_KEY']) {
    if (Object.hasOwn(values, key)) env[key] = values[key];
  }
  return env;
}
function requireManualDatabaseRun(env = process.env) {
  assert.equal(env.QUANTOS_MANUAL_F05_F07, '1', 'MANUAL_F05_F07_REQUIRED: full F05/F07 database maintenance is opt-in; set QUANTOS_MANUAL_F05_F07=1');
  assert(!env.GITHUB_EVENT_NAME || env.GITHUB_EVENT_NAME === 'workflow_dispatch', 'F05/F07 database maintenance cannot run on push, pull_request or schedule');
}
async function requireDatabaseHeadroom(client) {
  const bytes = Number((await client.query('select pg_database_size(current_database())::text as bytes')).rows[0].bytes);
  assert(Number.isSafeInteger(bytes) && bytes >= 0, 'database size unavailable');
  assert(bytes < 256 * 1024 * 1024, 'DATABASE_FIXTURE_BUDGET: database is at least 256 MiB; archive/rebuild the disposable test target before adding retained fixtures');
  return bytes;
}
module.exports = { loadLocalDatabaseEnvironment, requireManualDatabaseRun, requireDatabaseHeadroom };
