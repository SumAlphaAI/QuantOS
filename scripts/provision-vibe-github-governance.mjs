#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const baseline = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "third_party/vibe-trading/baseline.lock.json"), "utf8"),
);
const remoteLock = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "forks/vibe-trading/repository.lock.json"), "utf8"),
);
const policy = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, "forks/vibe-trading/branch-protection-policy.json"),
    "utf8",
  ),
);
const apply = process.argv.includes("--apply");

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function credentialToken() {
  const environmentToken =
    process.env.TP01_FORK_ADMIN_TOKEN ?? process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (environmentToken) return environmentToken;
  try {
    const credential = execFileSync("git", ["credential", "fill"], {
      encoding: "utf8",
      input: "protocol=https\nhost=github.com\n\n",
      stdio: ["pipe", "pipe", "ignore"],
      timeout: 5_000,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "Never",
      },
    });
    const password = credential
      .split("\n")
      .find((line) => line.startsWith("password="))
      ?.slice("password=".length);
    if (password) return password;
  } catch {
    // Fall through to the actionable error below without exposing credentials.
  }
  throw new Error(
    "GitHub authentication is required; set TP01_FORK_ADMIN_TOKEN/GH_TOKEN/GITHUB_TOKEN or configure the git credential helper",
  );
}

function repositoryCoordinates() {
  const parsed = new URL(remoteLock.fork.url);
  const [owner, repositoryWithSuffix] = parsed.pathname.replace(/^\//, "").split("/");
  return { owner, repository: repositoryWithSuffix.replace(/\.git$/, "") };
}

async function github(method, apiPath, token, body) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "QuantOS-TP01-governance-gate",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const acceptedPermissions = response.headers.get("x-accepted-github-permissions");
    throw new Error(
      `GitHub ${method} ${apiPath} failed (${response.status}): ${payload.message}` +
        (acceptedPermissions ? `; required permissions: ${acceptedPermissions}` : ""),
    );
  }
  return payload;
}

async function githubOrNull(method, apiPath, token) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "QuantOS-TP01-governance-gate",
    },
  });
  if (response.status === 404) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`GitHub ${method} ${apiPath} failed (${response.status}): ${payload.message}`);
  }
  return payload;
}

function protectionPayload(branchPolicy) {
  return {
    required_status_checks: {
      strict: true,
      contexts: branchPolicy.requiredStatusChecks,
    },
    enforce_admins: policy.enforceAdmins,
    required_pull_request_reviews: {
      dismiss_stale_reviews: branchPolicy.dismissStaleApprovals,
      require_code_owner_reviews: false,
      required_approving_review_count: branchPolicy.requiredPullRequestReviews,
      require_last_push_approval: true,
    },
    restrictions: null,
    required_linear_history: branchPolicy.requiredLinearHistory,
    allow_force_pushes: branchPolicy.allowForcePushes,
    allow_deletions: branchPolicy.allowDeletions,
    required_conversation_resolution: branchPolicy.requiredConversationResolution,
    lock_branch: false,
    allow_fork_syncing: false,
  };
}

function verifyProtection(actual, expected, branch) {
  const contexts = [...(actual.required_status_checks?.contexts ?? [])].sort();
  assertEqual(contexts, [...expected.required_status_checks.contexts].sort(), `${branch} checks`);
  assertEqual(actual.required_status_checks?.strict, true, `${branch} strict checks`);
  assertEqual(actual.enforce_admins?.enabled, expected.enforce_admins, `${branch} admins`);
  assertEqual(
    actual.required_pull_request_reviews?.required_approving_review_count,
    expected.required_pull_request_reviews.required_approving_review_count,
    `${branch} review count`,
  );
  assertEqual(
    actual.required_pull_request_reviews?.dismiss_stale_reviews,
    expected.required_pull_request_reviews.dismiss_stale_reviews,
    `${branch} stale reviews`,
  );
  assertEqual(
    actual.required_pull_request_reviews?.require_last_push_approval,
    true,
    `${branch} last push approval`,
  );
  for (const [field, expectedValue] of [
    ["required_linear_history", expected.required_linear_history],
    ["allow_force_pushes", expected.allow_force_pushes],
    ["allow_deletions", expected.allow_deletions],
    ["required_conversation_resolution", expected.required_conversation_resolution],
  ]) {
    assertEqual(actual[field]?.enabled, expectedValue, `${branch} ${field}`);
  }
}

const token = credentialToken();
const { owner, repository } = repositoryCoordinates();
const repositoryPath = `/repos/${owner}/${repository}`;
const metadata = await github("GET", repositoryPath, token);
assertEqual(metadata.fork, true, "GitHub fork flag");
assertEqual(metadata.parent?.full_name?.toLowerCase(), "hkuds/vibe-trading", "GitHub fork parent");
if (apply && (!metadata.permissions?.admin || !metadata.permissions?.push)) {
  throw new Error(
    `token repository access is insufficient: admin=${Boolean(metadata.permissions?.admin)}, push=${Boolean(metadata.permissions?.push)}; select sumalphai/Vibe-Trading and grant Administration + Contents + Workflows read/write`,
  );
}

if (apply) {
  for (const branch of [remoteLock.fork.baseBranch, remoteLock.fork.integrationBranch]) {
    const referencePath = `${repositoryPath}/git/ref/heads/${encodeURIComponent(branch)}`;
    const existing = await githubOrNull("GET", referencePath, token);
    if (existing) {
      assertEqual(existing.object.sha, baseline.upstream.commit, `${branch} existing remote SHA`);
      continue;
    }
    await github("POST", `${repositoryPath}/git/refs`, token, {
      ref: `refs/heads/${branch}`,
      sha: baseline.upstream.commit,
    });
  }
  for (const branchPolicy of policy.protectedBranches) {
    await github(
      "PUT",
      `${repositoryPath}/branches/${encodeURIComponent(branchPolicy.name)}/protection`,
      token,
      protectionPayload(branchPolicy),
    );
  }
}

for (const branchPolicy of policy.protectedBranches) {
  const branch = await github(
    "GET",
    `${repositoryPath}/branches/${encodeURIComponent(branchPolicy.name)}`,
    token,
  );
  assertEqual(branch.commit.sha, baseline.upstream.commit, `${branchPolicy.name} remote SHA`);
  assertEqual(branch.protected, true, `${branchPolicy.name} protected flag`);
  const expected = protectionPayload(branchPolicy);
  const actual = await github(
    "GET",
    `${repositoryPath}/branches/${encodeURIComponent(branchPolicy.name)}/protection`,
    token,
  );
  verifyProtection(actual, expected, branchPolicy.name);
}

console.log(
  `TP01 GitHub governance ${apply ? "applied and " : ""}verified for ${owner}/${repository} at ${baseline.upstream.commit}.`,
);
