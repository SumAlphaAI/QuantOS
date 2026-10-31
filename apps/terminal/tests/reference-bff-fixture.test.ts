import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { referenceBffExecutable, referenceBffRoot, referenceBffSourceEnv } from "./helpers/reference-bff";

it("resolves the same real fixture target from repository and package working directories", () => {
  const helper = new URL("./helpers/reference-bff.ts", import.meta.url).href;
  const outputs = [referenceBffRoot, resolve(referenceBffRoot, "apps/terminal")].map(cwd => {
    const child = spawnSync(process.execPath, ["--input-type=module", "-e",
      `const {referenceBffExecutable}=await import(${JSON.stringify(helper)}); console.log(referenceBffExecutable({}));`],
    { cwd, encoding: "utf8", env: { NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME } });
    expect(child.status, child.stderr).toBe(0);
    return child.stdout.trim();
  });
  expect(outputs[0]).toBe(referenceBffExecutable({}));
  expect(outputs[1]).toBe(outputs[0]);
});

it("uses the Cargo target override for the binary built by an archive runner", () => {
  expect(referenceBffExecutable({ CARGO_TARGET_DIR: "target-fixture" })).toBe(
    resolve(referenceBffRoot, "target-fixture/debug", process.platform === "win32" ? "bff-gateway.exe" : "bff-gateway"));
  const target = resolve(referenceBffRoot, "../external-cargo-target");
  expect(referenceBffExecutable({ CARGO_TARGET_DIR: target })).toBe(
    resolve(target, "debug", process.platform === "win32" ? "bff-gateway.exe" : "bff-gateway"));
});

it("forwards only explicit archive provenance and never invents a source SHA", () => {
  expect(referenceBffSourceEnv({})).toEqual({});
  const sha = "1234567890abcdef1234567890abcdef12345678";
  expect(referenceBffSourceEnv({ GITHUB_SHA: sha, DATABASE_URL: "synthetic", AWS_SECRET_ACCESS_KEY: "synthetic" }))
    .toEqual({ GITHUB_SHA: sha });
});

it("uses the Cargo-emitted explicit fixture without falling back to a stale debug binary", () => {
  const executable = resolve(referenceBffRoot, "custom output/owned-fixture/bff-gateway");
  expect(referenceBffExecutable({ QUANTOS_REFERENCE_BFF_EXECUTABLE: executable, CARGO_TARGET_DIR: "stale" })).toBe(executable);
  expect(referenceBffExecutable({ QUANTOS_REFERENCE_BFF_EXECUTABLE: "/missing/bff-gateway" })).toBe("/missing/bff-gateway");
  expect(() => referenceBffExecutable({ QUANTOS_REFERENCE_BFF_EXECUTABLE: "" })).toThrow("Empty explicit");
});

it("serves cold reference domains within the existing ten-second request deadline after readiness", async () => {
  const { createServer } = await import("node:net");
  const reserve = createServer();
  await new Promise<void>(r => reserve.listen(0, "127.0.0.1", r));
  const port = (reserve.address() as { port: number }).port;
  await new Promise<void>(r => reserve.close(() => r()));
  const child = spawn(referenceBffExecutable(), [], { cwd: referenceBffRoot,
    env: { ...referenceBffSourceEnv(), NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME,
      QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_BIND: `127.0.0.1:${port}` },
    stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", b => { stderr += String(b); });
  try {
    await new Promise<void>((ready, reject) => {
      const timer = setTimeout(() => reject(Error("reference startup timeout")), 30000);
      child.once("error", e => { clearTimeout(timer); reject(e); });
      child.once("exit", () => { clearTimeout(timer); reject(Error(`reference exited: ${stderr}`)); });
      child.stdout.on("data", b => { if (String(b).includes('"ready":true')) { clearTimeout(timer); ready(); } });
    });
    for (const path of ["/v1/proposals", "/v1/strategies", "/v1/operations/health"]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        headers: { cookie: "quantos_session=session-current" }, signal: AbortSignal.timeout(10000),
      });
      expect(response.status, path).toBe(200);
      expect(await response.json(), path).toBeTruthy();
    }
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise<void>(r => child.once("close", () => r()));
    }
  }
}, 45000);
