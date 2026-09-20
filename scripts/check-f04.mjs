import { spawnSync } from "node:child_process";

function corpusRun() {
  const result = spawnSync(
    "cargo",
    ["run", "--quiet", "--locked", "-p", "quantos-testkit", "--bin", "fixture-corpus"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return JSON.parse(result.stdout);
}

const first = corpusRun();
const second = corpusRun();
if (!/^sha256:[0-9a-f]{64}$/.test(first.digest) || first.digest !== second.digest) {
  throw new Error(`F04 fixture corpus is not deterministic: ${first.digest} != ${second.digest}`);
}
if (first.fixtures !== 1000 || second.fixtures !== 1000) {
  throw new Error("F04 fixture corpus must contain exactly 1,000 fixtures per process");
}
const p95Micros = Math.max(first.p95Micros, second.p95Micros);
if (p95Micros >= 50_000) {
  throw new Error(`F04 domain operation P95 ${p95Micros}us exceeds 50ms`);
}

console.log(JSON.stringify({ acceptance: "PASS", fixtures: 1000, digest: first.digest, p95Micros }));
