const crypto = require('node:crypto');

function validateF09MigrationLedger(remote, local) {
  const names = [...local.keys()].sort();
  if (JSON.stringify(remote.map(row => row.filename)) !== JSON.stringify(names)) {
    throw new Error('F09 target migration ledger differs from repository files');
  }
  for (const row of remote) {
    const expected = crypto.createHash('sha256').update(local.get(row.filename)).digest('hex');
    if (row.sha256 !== expected) throw new Error(`F09 target migration checksum mismatch: ${row.filename}`);
  }
  // Later reviewed migrations advance the head; F09 needs its prerequisite
  // present with the exact checksum, rather than permanently remaining last.
  if (!names.includes('20260927093000_f09_execution_metric_returning.sql')) {
    throw new Error('F09 target migration prerequisite is missing');
  }
  return names.at(-1);
}
module.exports = { validateF09MigrationLedger };
