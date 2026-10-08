const fs = require('node:fs');

function targetUrl(env = process.env) {
  let u;
  try { u = new URL(env.DATABASE_URL); } catch { throw Error('R01_DATABASE_CONFIG'); }
  if (!/\.supabase\.(co|com)$/.test(u.hostname)) throw Error('R01_SUPABASE_REQUIRED');
  const mode = env.QUANTOS_R01_POOL_MODE || 'configured';
  if (!['configured', 'transaction'].includes(mode)) throw Error('R01_POOL_MODE');
  if (mode === 'transaction') {
    if (!u.hostname.endsWith('.pooler.supabase.com') || !['5432', '6543'].includes(u.port)) throw Error('R01_SHARED_POOL_REQUIRED');
    // Same project, role, database, credentials and TLS. No Dashboard/pool-size mutation.
    u.port = '6543';
  }
  return u.toString();
}
function client(databaseUrl, name = 'quantos-r01', timeout = 10000) {
  const { Client } = require('pg');
  const u = new URL(databaseUrl), ca = u.searchParams.get('sslrootcert');
  return new Client({ host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password), database: u.pathname.slice(1), connectionTimeoutMillis: 10000,
    query_timeout: timeout, application_name: name, keepAlive: true, keepAliveInitialDelayMillis: 10000,
    ssl: { rejectUnauthorized: !['require', 'prefer'].includes(u.searchParams.get('sslmode')), ...(ca ? { ca: fs.readFileSync(ca, 'utf8') } : {}) } });
}
function connectionMode(databaseUrl) {
  const u = new URL(databaseUrl);
  return u.hostname.endsWith('.pooler.supabase.com') ? (u.port === '6543' ? 'transaction' : 'session') : 'direct';
}
module.exports = { targetUrl, client, connectionMode };
