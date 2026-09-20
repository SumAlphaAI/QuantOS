import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repo = path.resolve(new URL("../..", import.meta.url).pathname);
const checker = path.join(repo, "scripts", "check-proto-config.mjs");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "quantos-f03-config-"));
  fs.mkdirSync(path.join(root, "scripts"), {recursive: true});
  for (const file of ["buf.gen.yaml", "Makefile"]) {
    fs.copyFileSync(path.join(repo, file), path.join(root, file));
  }
  fs.copyFileSync(
    path.join(repo, "scripts", "generate-proto.sh"),
    path.join(root, "scripts", "generate-proto.sh"),
  );
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  return root;
}

function run(root) {
  try {
    return {
      ok: true,
      output: execFileSync(process.execPath, [checker], {
        cwd: repo,
        encoding: "utf8",
        env: {...process.env, QUANTOS_GATE_ROOT: root},
        stdio: ["ignore", "pipe", "pipe"],
      }),
    };
  } catch (error) {
    return {ok: false, output: `${error.stdout ?? ""}${error.stderr ?? ""}`};
  }
}

test("proto generation configuration is pinned and lock-preserving", (t) => {
  assert.equal(run(fixture(t)).ok, true);
});

test("proto generation configuration rejects an unpinned remote plugin", (t) => {
  const root = fixture(t);
  const file = path.join(root, "buf.gen.yaml");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(":v2.29.0", ""));
  const result = run(root);
  assert.equal(result.ok, false);
  assert.match(result.output, /not version-pinned/);
});

test("proto generation configuration rejects implicit dependency updates", (t) => {
  const root = fixture(t);
  fs.appendFileSync(path.join(root, "scripts", "generate-proto.sh"), "\nbuf dep update\n");
  const result = run(root);
  assert.equal(result.ok, false);
  assert.match(result.output, /must not update buf.lock/);
});
