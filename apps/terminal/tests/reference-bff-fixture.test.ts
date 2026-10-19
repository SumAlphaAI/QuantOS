import { spawnSync } from "node:child_process";
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
