// Connections are short lived: preparation closes before Cargo; cleanup is separate.
const { connectBeforeStatements } = require('./postgres-bootstrap.cjs');
const { client } = require('./r01-db.cjs');
const fs = require('node:fs'), path = require('node:path');
function operatorUrl(databaseUrl, env = process.env) {
  const url = new URL(databaseUrl);
  const ca = url.searchParams.get('sslrootcert') || env.QUANTOS_BFF_SSLROOTCERT;
  if (!ca || !path.isAbsolute(ca) || !fs.statSync(ca).isFile()) throw Error('R02_TRUSTED_CA_REQUIRED');
  url.searchParams.set('sslrootcert', ca); url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}
async function openConnection(databaseUrl, name, { record, phase, save,
  createClient = () => client(operatorUrl(databaseUrl), name, 15000), pause } = {}) {
  return connectBeforeStatements(() => {
    const connection = createClient();
    record.connectionClosed = false;
    let fault, statements = 0;
    connection.on('error', error => {
      error.chainPhase ||= phase.value; fault ||= error;
      record.transportErrors ||= [];
      record.transportErrors.push({ phase: phase.value, afterStatements: statements > 0,
        code: error.code || 'CONNECTION_ERROR' }); save();
    });
    const query = connection.query.bind(connection), end = connection.end.bind(connection);
    connection.query = async (...args) => {
      if (fault) throw fault;
      statements++;
      try { const result = await query(...args); if (fault) throw fault; return result; }
      catch (error) { error.chainPhase ||= phase.value; throw error; }
    };
    connection.end = async () => { await end(); record.connectionClosed = true; save(); if (fault && statements > 0) throw fault; };
    return connection;
  }, { record, pause, onAttempt: save });
}
module.exports = { openConnection, operatorUrl };
