import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);
const transientCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED',
  'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET']);
const transientTransport = error => error?.name === 'TimeoutError'
  || transientCodes.has(error?.code) || transientCodes.has(error?.cause?.code);

// Retry only a read-only registry GET. Invalid metadata, integrity, licensing and
// permanent HTTP/TLS errors remain failures; no cache or waiver can supply PASS.
export async function fetchLicenseMetadata(name, version, integrity, {
  fetchImpl = globalThis.fetch, pause = delay, onAttempt = () => {},
} = {}) {
  assert(typeof integrity === 'string' && integrity.length > 0, 'Locked integrity required');
  const key = `${name}@${version}`;
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const started = performance.now();
    let response, manifest;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw Object.assign(Error(`License metadata unavailable: ${key} ${response.status}`), {
          retryableMetadata: transientStatuses.has(response.status),
        });
      }
      manifest = await response.json();
    } catch (error) {
      const transient = error.retryableMetadata ?? transientTransport(error);
      onAttempt({ attempt, status: 'FAIL', transient, httpStatus: response?.status ?? null,
        errorKind: error.cause?.code ?? error.code ?? error.name, elapsedMs: performance.now() - started });
      if (!transient || attempt === 3) throw error;
      await pause(250 * attempt);
      continue;
    }
    const valid = manifest?.name === name && manifest?.version === version
      && manifest?.dist?.integrity === integrity;
    onAttempt({ attempt, status: valid ? 'PASS' : 'FAIL', transient: false,
      httpStatus: response.status, ...(!valid ? { errorKind: 'IDENTITY_OR_INTEGRITY_MISMATCH' } : {}),
      elapsedMs: performance.now() - started });
    if (!valid) throw Error(`License metadata identity/integrity mismatch: ${key}`);
    return manifest;
  }
}
