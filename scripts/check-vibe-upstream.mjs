#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith("--")) {
      continue;
    }
    args.set(value.slice(2), argv[i + 1] ?? "");
    i += 1;
  }
  return args;
}

function requireArg(args, name) {
  const value = args.get(name);
  if (!value) {
    throw new Error(`missing required argument --${name}`);
  }
  return value;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "sumalpha-quantos-tp01-monitor",
    },
  });
  if (!response.ok) {
    throw new Error(`request failed for ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/plain",
      "User-Agent": "sumalpha-quantos-tp01-monitor",
    },
  });
  if (!response.ok) {
    throw new Error(`request failed for ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function classifyTagDrift(baseline, latestTagDigests) {
  const dependencyDrift =
    latestTagDigests.pyprojectToml !== baseline.dependencyDigests.projectDescriptor.sha256 ||
    latestTagDigests.requirementsLock !== baseline.dependencyDigests.pythonLock.sha256;
  const licenseDrift =
    latestTagDigests.license !== baseline.license.licenseFile.sha256 ||
    latestTagDigests.notice !== baseline.license.noticeFile.sha256;

  if (licenseDrift || dependencyDrift) {
    return "S1";
  }
  return "S2";
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# TP01 Vibe-Trading Upstream Monitor");
  lines.push("");
  lines.push(`- checked at: \`${report.checkedAt}\``);
  lines.push(`- locked baseline: \`${report.baseline.upstream.tag}\` @ \`${report.baseline.upstream.commit}\``);
  lines.push(`- latest upstream tag: \`${report.latest.tag.name}\` @ \`${report.latest.tag.commit}\``);
  lines.push(`- latest upstream main: \`${report.latest.main.commit}\``);
  lines.push("");
  lines.push("## Candidates");
  lines.push("");

  if (report.candidates.length === 0) {
    lines.push("- none");
    return `${lines.join("\n")}\n`;
  }

  for (const candidate of report.candidates) {
    lines.push(`### ${candidate.severity}: ${candidate.title}`);
    lines.push("");
    lines.push(`- reason: ${candidate.reason}`);
    lines.push(`- target ref: \`${candidate.ref}\``);
    if (candidate.digests) {
      lines.push(`- digest drift: ${JSON.stringify(candidate.digests)}`);
    }
    lines.push(`- action: ${candidate.action}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const args = parseArgs(process.argv.slice(2));
const baselinePath = path.resolve(repoRoot, requireArg(args, "baseline"));
const jsonOutputPath = path.resolve(repoRoot, requireArg(args, "json-output"));
const markdownOutputPath = path.resolve(repoRoot, requireArg(args, "markdown-output"));

const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const { owner, repo } = baseline.upstream;

const [mainRef, tagList] = await Promise.all([
  fetchJson(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${baseline.upstream.defaultBranch}`),
  fetchJson(`https://api.github.com/repos/${owner}/${repo}/tags?per_page=10`),
]);

if (!Array.isArray(tagList) || tagList.length === 0) {
  throw new Error("failed to resolve upstream tags");
}

const latestTag = tagList[0];
const latestMainCommit = mainRef.object.sha;
const candidates = [];

if (latestMainCommit !== baseline.upstream.commit) {
  candidates.push({
    severity: "S3",
    title: "upstream main advanced beyond locked baseline",
    reason: "research drift detected on the default branch; record candidate only",
    ref: `${baseline.upstream.defaultBranch}@${latestMainCommit}`,
    action: "open or update a research-only decision record; do not change production dependencies",
  });
}

if (
  latestTag.name !== baseline.upstream.tag ||
  latestTag.commit.sha !== baseline.upstream.commit
) {
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${latestTag.name}`;
  const [licenseText, noticeText, lockText, pyprojectText] = await Promise.all([
    fetchText(`${rawBase}/LICENSE`),
    fetchText(`${rawBase}/NOTICE`),
    fetchText(`${rawBase}/requirements-lock.txt`),
    fetchText(`${rawBase}/pyproject.toml`),
  ]);

  const digests = {
    license: sha256(licenseText),
    notice: sha256(noticeText),
    requirementsLock: sha256(lockText),
    pyprojectToml: sha256(pyprojectText),
  };

  const severity = classifyTagDrift(baseline, digests);
  candidates.push({
    severity,
    title: "new upstream release tag detected",
    reason: `locked baseline ${baseline.upstream.tag} differs from latest upstream tag ${latestTag.name}`,
    ref: `${latestTag.name}@${latestTag.commit.sha}`,
    digests,
    action:
      severity === "S1"
        ? "run license and dependency diff review before any sync candidate may proceed"
        : "record a planned sync candidate and queue contract/replay regression review",
  });
}

const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  baseline,
  latest: {
    tag: {
      name: latestTag.name,
      commit: latestTag.commit.sha,
    },
    main: {
      branch: baseline.upstream.defaultBranch,
      commit: latestMainCommit,
    },
  },
  candidates,
};

fs.mkdirSync(path.dirname(jsonOutputPath), { recursive: true });
fs.mkdirSync(path.dirname(markdownOutputPath), { recursive: true });
fs.writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(markdownOutputPath, renderMarkdown(report));

console.log(`Wrote ${path.relative(repoRoot, jsonOutputPath)}`);
console.log(`Wrote ${path.relative(repoRoot, markdownOutputPath)}`);
console.log(`Detected ${candidates.length} candidate(s).`);
