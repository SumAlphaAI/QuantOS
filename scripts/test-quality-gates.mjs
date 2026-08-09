#!/usr/bin/env node

import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(join(tmpdir(), "quantos-gate-mutations-"));
const require = createRequire(import.meta.url);
const { assertMigrationLedgerMatches } = require("./db-cli.cjs");

function run(command, args, root) {
  return spawnSync(command, args, {
    cwd: repo,
    env: { ...process.env, QUANTOS_GATE_ROOT: root },
    encoding: "utf8",
  });
}

function expectRejected(name, command, args, root) {
  const result = run(command, args, root);
  if (result.status === 0) throw new Error(`${name}: injected breakage was accepted`);
  console.log(`PASS ${name}: gate rejected injected breakage`);
}

try {
  const lockRoot = join(scratch, "lock");
  mkdirSync(join(lockRoot, "engines"), { recursive: true });
  writeFileSync(join(lockRoot, "Cargo.lock"), "locked\n");
  writeFileSync(join(lockRoot, "pnpm-lock.yaml"), "locked\n");
  expectRejected("missing dependency lock", "bash", [join(repo, "scripts/check-lockfiles.sh")], lockRoot);

  const protoRoot = join(scratch, "proto");
  cpSync(join(repo, "proto"), join(protoRoot, "proto"), { recursive: true });
  cpSync(join(repo, "buf.yaml"), join(protoRoot, "buf.yaml"));
  cpSync(join(repo, "buf.gen.yaml"), join(protoRoot, "buf.gen.yaml"));
  writeFileSync(join(protoRoot, "proto", "README.md"), "fixture\n");
  writeFileSync(join(protoRoot, "proto", "deliberately_broken.proto"), 'syntax = "proto3";\nmessage Broken { string value = ; }\n');
  expectRejected("broken proto", "bash", [join(repo, "scripts/check-proto.sh")], protoRoot);

  const migrationRoot = join(scratch, "migration");
  cpSync(join(repo, "supabase/migrations"), join(migrationRoot, "supabase/migrations"), { recursive: true });
  writeFileSync(join(migrationRoot, "supabase/migrations", "bad-name.sql"), "select 1;\n");
  expectRejected("invalid migration", "bash", [join(repo, "scripts/check-migration-filenames.sh")], migrationRoot);
  try {
    assertMigrationLedgerMatches(["20260101000000_local.sql"], ["20260101000000_remote.sql"]);
    throw new Error("schema drift: injected ledger mismatch was accepted");
  } catch (error) {
    if (!String(error.message).includes("does not match")) throw error;
    console.log("PASS schema drift: gate rejected injected ledger mismatch");
  }

  const rlsRoot = join(scratch, "rls");
  mkdirSync(join(rlsRoot, "supabase/migrations"), { recursive: true });
  writeFileSync(join(rlsRoot, "supabase/migrations/20260101000000_broken.sql"), `
    create table quantos.unprotected (id uuid default gen_random_uuid(), owner uuid references auth.users, created_at timestamptz);
  `);
  expectRejected("missing RLS", "bash", [join(repo, "scripts/check-rls-baseline.sh")], rlsRoot);

  const secretRoot = join(scratch, "secret");
  mkdirSync(secretRoot, { recursive: true });
  writeFileSync(join(secretRoot, "leaked.env"), `TOKEN=ghp_${"A".repeat(36)}\n`);
  expectRejected("injected secret", "node", [join(repo, "scripts/check-secrets.mjs")], secretRoot);

  console.log("All F02 deliberate-break quality-gate tests passed.");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
