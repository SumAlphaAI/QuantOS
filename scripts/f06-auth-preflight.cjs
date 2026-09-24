async function main() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key || !publishable) {
    throw Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PUBLISHABLE_KEY are required');
  }
  const admin = await fetch(new URL('/auth/v1/admin/users?page=1&per_page=1', base), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
  });
  const publicAuth = await fetch(new URL('/auth/v1/settings', base), {
    headers: { apikey: publishable },
    signal: AbortSignal.timeout(10000),
  });
  console.log(JSON.stringify({
    status: admin.ok && publicAuth.ok ? 'READY' : 'BLOCKED',
    authAdminHttp: admin.status,
    publishableHttp: publicAuth.status,
  }));
  if (!admin.ok || !publicAuth.ok) process.exitCode = 1;
}

main().catch(error => {
  console.error(`F06 Auth preflight failed: ${error.name}`);
  process.exitCode = 1;
});
