export function validateRuns(first, second) {
  if (!/^sha256:[0-9a-f]{64}$/.test(first?.digest) || first.digest !== second?.digest) {
    throw new Error("F04 fixture corpus digests differ or are missing");
  }
  for (const run of [first, second]) {
    if (run.fixtures !== 1000) throw new Error("F04 requires 1,000 fixtures per process");
    if (!Number.isFinite(run.p95Micros) || run.p95Micros < 0 || run.p95Micros >= 50_000) {
      throw new Error("F04 requires finite non-negative P95 below 50ms");
    }
  }
  return { acceptance: "PASS", fixtures: 1000, digest: first.digest,
    p95Micros: Math.max(first.p95Micros, second.p95Micros) };
}
