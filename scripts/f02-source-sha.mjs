export function expectedCiSourceSha(env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true' && !env.GITHUB_SHA) return null;
  const sha = env.GITHUB_EVENT_NAME === 'pull_request'
    ? env.QUANTOS_SOURCE_SHA
    : env.GITHUB_SHA;
  if (!/^[a-f0-9]{40}$/.test(sha ?? '')) {
    throw new Error('F02 source SHA is missing or invalid');
  }
  if (env.GITHUB_EVENT_NAME !== 'pull_request'
    && env.QUANTOS_SOURCE_SHA
    && env.QUANTOS_SOURCE_SHA !== env.GITHUB_SHA) {
    throw new Error('F02 non-PR source SHA differs from GitHub event SHA');
  }
  return sha;
}
