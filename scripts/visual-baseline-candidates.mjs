import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { requiredVisualPaths } from './check-visual-baselines.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const mode = process.argv[2];
const directory = path.resolve(process.argv[3] ?? 'artifacts/visual-candidates');
const expected = requiredVisualPaths('linux');

if (mode === 'capture') {
  if (process.platform !== 'linux' || process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REF !== 'refs/heads/main') {
    throw Error('Candidates must be captured by GitHub Actions on Linux main');
  }
  const commit = git('rev-parse', 'HEAD');
  if (commit !== process.env.GITHUB_SHA) throw Error('Candidate source SHA mismatch');
  const files = expected.map((relative) => {
    const bytes = fs.readFileSync(path.join(root, relative));
    const { width, height } = PNG.sync.read(bytes);
    if (width !== 1440 || height < 900) throw Error(`Unexpected dimensions: ${relative}`);
    const target = path.join(directory, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    return { path: relative, sha256: digest(bytes), width, height, scope: 'A11 Linux browser visual baseline' };
  });
  const receipt = {
    schema: 'quantos-visual-candidates/v1', status: 'CANDIDATE_REQUIRES_REVIEW', commit,
    run: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    runner: 'ubuntu-24.04', playwright: JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@playwright/test/package.json'))).version,
    files,
  };
  fs.writeFileSync(path.join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`Packaged ${files.length} candidates; this is not a visual acceptance receipt.`);
} else if (mode === 'import-reviewed') {
  const sha = process.argv[4];
  if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw Error('Provide the reviewed capture commit SHA');
  const receipt = JSON.parse(fs.readFileSync(path.join(directory, 'receipt.json')));
  if (receipt.schema !== 'quantos-visual-candidates/v1' || receipt.status !== 'CANDIDATE_REQUIRES_REVIEW' || receipt.commit !== sha || receipt.runner !== 'ubuntu-24.04' || !/^https:\/\/github\.com\/SumAlphaAI\/QuantOS\/actions\/runs\/\d+$/.test(receipt.run)) throw Error('Candidate provenance mismatch');
  if (JSON.stringify(receipt.files.map((entry) => entry.path).sort()) !== JSON.stringify([...expected].sort())) throw Error('Expected exactly 12 Linux snapshots');
  // Reject stale captures if rendering inputs changed after the capture commit.
  git('diff', '--exit-code', sha, '--', 'apps/terminal', 'packages', 'tests/e2e', 'playwright.config.ts', 'pnpm-lock.yaml', 'package.json');
  const files = receipt.files.map((entry) => {
    const bytes = fs.readFileSync(path.join(directory, entry.path));
    const png = PNG.sync.read(bytes);
    if (digest(bytes) !== entry.sha256 || png.width !== entry.width || png.height !== entry.height || png.width !== 1440 || png.height < 900) throw Error(`Candidate integrity failure: ${entry.path}`);
    return { entry, bytes };
  });
  const manifestPath = path.join(root, 'tests/e2e/visual-baselines.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  for (const { entry, bytes } of files) {
    const target = path.join(root, entry.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  manifest.entries = [...manifest.entries.filter((entry) => !expected.includes(entry.path)), ...files.map(({ entry }) => entry)].sort((a, b) => a.path.localeCompare(b.path));
  manifest.linuxCapture = { commit: sha, run: receipt.run, runner: receipt.runner, playwright: receipt.playwright };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('Imported reviewed candidates. Commit and manually push, then require a fresh comparison run.');
} else {
  throw Error('Usage: visual-baseline-candidates.mjs capture [directory] | import-reviewed <directory> <capture-sha>');
}
