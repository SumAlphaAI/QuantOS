import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repo = path.resolve(new URL("../..", import.meta.url).pathname);
const checker = path.join(repo, "scripts", "check-json-schemas.mjs");
const sourceSchemas = path.join(repo, "proto", "jsonschema");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "quantos-f03-schema-"));
  const destination = path.join(root, "proto", "jsonschema");
  fs.mkdirSync(destination, {recursive: true});
  fs.cpSync(sourceSchemas, destination, {recursive: true});
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  return {root, destination};
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
    return {
      ok: false,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`,
    };
  }
}

test("standalone JSON schema gate passes the complete generated catalog", (t) => {
  const {root} = fixture(t);
  assert.equal(run(root).ok, true);
});

test("standalone JSON schema gate rejects a missing planned domain schema", (t) => {
  const {root, destination} = fixture(t);
  fs.rmSync(path.join(destination, "v1StrategyRelease.schema.json"));
  const result = run(root);
  assert.equal(result.ok, false);
  assert.match(result.output, /Missing planned domain JSON schema/);
});

test("standalone JSON schema gate rejects an unresolved reference", (t) => {
  const {root, destination} = fixture(t);
  const file = path.join(destination, "v1TradeCommand.schema.json");
  const schema = JSON.parse(fs.readFileSync(file, "utf8"));
  delete schema.definitions.v1CommandMetadata;
  fs.writeFileSync(file, `${JSON.stringify(schema, null, 2)}\n`);
  const result = run(root);
  assert.equal(result.ok, false);
  assert.match(result.output, /can't resolve reference/);
});
