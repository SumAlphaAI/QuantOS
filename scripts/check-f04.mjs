import { spawnSync } from "node:child_process";
import { validateRuns } from "./f04-measurements.mjs";

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
console.log(JSON.stringify(validateRuns(first, second)));
