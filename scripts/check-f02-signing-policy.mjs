import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function validateSigningPolicy(environment, policies) {
  const policy = environment.deployment_branch_policy;
  if (environment.name !== 'f02-signing' || policy?.custom_branch_policies !== true || policy?.protected_branches !== false) {
    throw Error('f02-signing must already exist with custom deployment branch policies');
  }
  if (policies.total_count !== 1 || policies.branch_policies?.length !== 1 || policies.branch_policies[0].name !== 'main' || policies.branch_policies[0].type !== 'branch') {
    throw Error('Signing environment must allow only the main branch, with no tag or wildcard policies');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.env.GITHUB_EVENT_NAME !== 'push' || process.env.GITHUB_REF !== 'refs/heads/main') throw Error('Formal signing is main-push only');
  const base = `${process.env.GITHUB_API_URL}/repos/${process.env.GITHUB_REPOSITORY}/environments/f02-signing`;
  const get = async (url) => {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    if (!response.ok) throw Error(`Cannot verify existing signing environment (HTTP ${response.status}); administrator configuration is required`);
    return response.json();
  };
  validateSigningPolicy(await get(base), await get(`${base}/deployment-branch-policies?per_page=100`));
  console.log('PASS: existing signing environment allows main branch only; no settings were changed.');
}
