import { spawnSync } from "node:child_process";
import { validateRuns, validateFunctionalRuns } from "./f04-measurements.mjs";

const functional=process.argv.includes("--functional");
function corpusRun() {
  const result = spawnSync(
    "cargo",
    ["run", "--quiet", "--locked", "-p", "quantos-testkit", "--bin", "fixture-corpus",...(functional?["--","--functional"]:[])],
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
console.log(JSON.stringify((functional?validateFunctionalRuns:validateRuns)(first, second)));
