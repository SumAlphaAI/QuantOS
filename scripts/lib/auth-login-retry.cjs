const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

function isLoginTransportFailure(error) {
  if (error?.name === 'TimeoutError') return true;
  return error?.name === 'TypeError' &&
    ['ECONNRESET', 'ETIMEDOUT', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'].includes(error.cause?.code);
}

// Only the password-token request uses this helper, never identity creation,
// mutations, authorization denials, cancellation or business assertions.
async function runAuthLoginAttempts(execute, { maxAttempts = 3, onAttempt = () => {}, clock = () => performance.now() } = {}) {
  assert(Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 3, 'Auth login attempt budget must be 1..3');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = clock();
    try {
      const value = await execute();
      onAttempt({ attempt, status: 'PASS', transient: false, elapsedMs: Math.max(0, clock() - started) });
      return value;
    } catch (error) {
      const transient = isLoginTransportFailure(error);
      const causeCode = ['ECONNRESET', 'ETIMEDOUT', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'].includes(error?.cause?.code) ? error.cause.code : undefined;
      onAttempt({ attempt, status: 'FAIL', transient, elapsedMs: Math.max(0, clock() - started),
        errorKind: error?.name ?? 'Error', ...(causeCode ? { causeCode } : {}) });
      if (!transient || attempt === maxAttempts) throw error;
    }
  }
}

function validateLoginAttempts(requests) {
  assert(Array.isArray(requests) && requests.length === 2, 'two actual Auth logins required');
  for (const [index, request] of requests.entries()) {
    assert.equal(request.id, index + 1);assert.equal(request.route, '/auth/v1/token?grant_type=password');
    assert.equal(request.timeoutMs, 15000);assert.equal(request.maxAttempts, 3);
    assert(Array.isArray(request.attempts) && request.attempts.length >= 1 && request.attempts.length <= 3);
    for (const [i, attempt] of request.attempts.entries()) {
      assert.equal(attempt.attempt, i + 1);assert(Number.isFinite(attempt.elapsedMs) && attempt.elapsedMs >= 0);
      if (i === request.attempts.length - 1) { assert.equal(attempt.status, 'PASS');assert.equal(attempt.transient, false); }
      else { assert.equal(attempt.status, 'FAIL');assert.equal(attempt.transient, true);
        assert(isLoginTransportFailure({ name: attempt.errorKind, cause: { code: attempt.causeCode } }), 'semantic Auth failures cannot become PASS'); }
    }
  }
}

module.exports = { isLoginTransportFailure, runAuthLoginAttempts, validateLoginAttempts };
