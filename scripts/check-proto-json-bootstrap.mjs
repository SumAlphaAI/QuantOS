// Reproduce Buf's clean-output state in an isolated source/target directory.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const snapshot = mkdtempSync(path.join(tmpdir(), "quantos-proto-bootstrap-"));
const generated = "crates/quantos-proto/src/generated";
const hash = file => createHash("sha256").update(readFileSync(file)).digest("hex");
try {
  const files = execFileSync("git", ["ls-files", "-z"], {cwd: root, encoding: "utf8"}).split("\0").filter(Boolean);
  for (const file of files) {
    if (file.startsWith(`${generated}/`) || !existsSync(path.join(root, file))) continue;
    if (file !== "Cargo.lock" && !file.endsWith("Cargo.toml") && !file.endsWith(".rs")) continue;
    mkdirSync(path.dirname(path.join(snapshot, file)), {recursive: true});
    cpSync(path.join(root, file), path.join(snapshot, file));
  }
  cpSync(path.join(root, "tools/proto-json-codegen"), path.join(snapshot, "tools/proto-json-codegen"), {recursive: true});
  mkdirSync(path.join(snapshot, "scripts"), {recursive: true});
  cpSync(path.join(root, "scripts/patch-protojson.py"), path.join(snapshot, "scripts/patch-protojson.py"));
  mkdirSync(path.join(snapshot, generated), {recursive: true});
  const descriptor = path.join(snapshot, "descriptor.bin");
  execFileSync(path.join(root, "node_modules/.bin/buf"), ["build", "-o", descriptor], {cwd: root, stdio: "inherit"});
  execFileSync("cargo", ["run", "--locked", "--quiet", "-p", "quantos-proto-json-codegen", "--", descriptor], {
    cwd: snapshot, env: {...process.env, CARGO_TARGET_DIR: path.join(snapshot, "target")}, stdio: "inherit",
  });
  const outputs = readdirSync(path.join(snapshot, generated)).sort();
  const expected = readdirSync(path.join(root, generated)).filter(file => file.endsWith(".serde.rs")).sort();
  assert.equal(expected.length, 6);
  assert.deepEqual(outputs, expected);
  for (const file of outputs) assert.equal(hash(path.join(snapshot, generated, file)), hash(path.join(root, generated, file)), file);
  console.log("PASS: standalone generator rebuilt all six identical ProtoJSON files with no SDK generated files and an empty Cargo target directory.");
} finally {
  rmSync(snapshot, {recursive: true, force: true});
}
