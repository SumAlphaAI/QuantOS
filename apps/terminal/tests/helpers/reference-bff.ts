import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const referenceBffRoot = fileURLToPath(new URL("../../../../", import.meta.url));

type FixtureEnv = Readonly<Record<string, string | undefined>>;

export function referenceBffExecutable(env: FixtureEnv = process.env): string {
  if (env.QUANTOS_REFERENCE_BFF_EXECUTABLE !== undefined) {
    if (!env.QUANTOS_REFERENCE_BFF_EXECUTABLE) throw Error("Empty explicit reference BFF executable");
    return resolve(referenceBffRoot, env.QUANTOS_REFERENCE_BFF_EXECUTABLE);
  }
  const target = resolve(referenceBffRoot, env.CARGO_TARGET_DIR || "target");
  return resolve(target, "debug", process.platform === "win32" ? "bff-gateway.exe" : "bff-gateway");
}

// Keep the fixture environment restricted. F01 archives have no .git and must
// forward the frozen source identity already supplied by the archive runner.
export function referenceBffSourceEnv(env: FixtureEnv = process.env): { GITHUB_SHA?: string } {
  return env.GITHUB_SHA ? { GITHUB_SHA: env.GITHUB_SHA } : {};
}
