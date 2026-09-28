// Copy only explicitly public startup fields; never persist raw service stderr.
module.exports = function startupEvidence(stderr) {
  return stderr.split('\n').flatMap(line => {
    let event;
    try { event = JSON.parse(line); } catch { return []; }
    if (event.event !== 'startup_phase' || event.service !== 'runtime-gateway'
        || !['bff_auth', 'runtime_store', 'worker_store'].includes(event.phase)
        || !['started', 'ready', 'retry_transport', 'failed'].includes(event.status)
        || !Number.isInteger(event.attempt) || event.attempt < 1 || event.attempt > 3) return [];
    return [{ phase: event.phase, status: event.status, attempt: event.attempt,
      ...(Number.isFinite(event.elapsed_ms) && event.elapsed_ms >= 0 ? { elapsedMs: event.elapsed_ms } : {}) }];
  });
};
