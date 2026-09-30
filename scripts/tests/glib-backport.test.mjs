import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyGlibBackport } from '../glib-backport.mjs';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quantos-glib-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const file of ['security/glib-backport.json', 'apps/terminal-desktop/src-tauri/Cargo.toml', 'apps/terminal-desktop/src-tauri/Cargo.lock', 'third_party/rust/glib']) {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    fs.cpSync(path.join(root, file), path.join(directory, file), { recursive: true });
  }
  return directory;
}

test('GLib backport rejects source rollback, missing files, and registry fallback', t => {
  assert.equal(verifyGlibBackport(root).status, 'BACKPORT_VERIFIED');
  const directory = fixture(t);
  const source = path.join(directory, 'third_party/rust/glib/src/variant_iter.rs');
  const fixed = fs.readFileSync(source, 'utf8');
  fs.writeFileSync(source, fixed.replace('&mut p,', '&p,'));
  assert.throws(() => verifyGlibBackport(directory), /digest mismatch/);
  fs.writeFileSync(source, fixed);
  const lock = path.join(directory, 'apps/terminal-desktop/src-tauri/Cargo.lock');
  fs.writeFileSync(lock, fs.readFileSync(lock, 'utf8').replace('name = "glib"\nversion = "0.18.5"', 'name = "glib"\nversion = "0.18.5"\nsource = "registry+https://github.com/rust-lang/crates.io-index"'));
  assert.throws(() => verifyGlibBackport(directory), /local patched GLib/);
  fs.unlinkSync(source);
  assert.throws(() => verifyGlibBackport(directory), /inventory mismatch/);
});

test('optimized GLib iterator preserves a C variadic out-pointer for all five affected methods', t => {
  verifyGlibBackport(root);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quantos-glib-abi-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = fs.readFileSync(path.join(root, 'third_party/rust/glib/src/variant_iter.rs'), 'utf8');
  const iterator = source.slice(source.indexOf('#[derive(Debug)]\npub struct VariantStrIter'), source.indexOf('\n#[cfg(test)]'));
  // Exercise the real vendored implementation, with a minimal C ABI fixture.
  // This does not claim native GTK/Tauri execution on Linux.
  fs.writeFileSync(path.join(directory, 'out.c'), `
#include <stdarg.h>
#include <stddef.h>
void g_variant_get_child(const void *variant, size_t index, const char *format, ...) {
  static const char *items[] = {"zero", "one", "two", "three", "four"};
  va_list args; va_start(args, format);
  char **out = va_arg(args, char **); *out = (char *)items[index];
  va_end(args);
}
`);
  fs.writeFileSync(path.join(directory, 'iterator.rs'), `
use std::iter::FusedIterator;
mod libc { pub use std::ffi::c_char; }
mod ffi { unsafe extern "C" { pub fn g_variant_get_child(v: *const std::ffi::c_void, i: usize, f: *const std::ffi::c_char, ...); } }
#[derive(Debug)] pub struct Variant;
struct Stash(*const std::ffi::c_void);
impl Variant { fn n_children(&self) -> usize { 5 } fn to_glib_none(&self) -> Stash { Stash(self as *const _ as *const _) } }
${iterator}
fn main() {
  let v = Variant;
  assert_eq!(VariantStrIter::new(&v).next(), Some("zero"));
  assert_eq!(VariantStrIter::new(&v).next_back(), Some("four"));
  assert_eq!(VariantStrIter::new(&v).nth(2), Some("two"));
  assert_eq!(VariantStrIter::new(&v).nth_back(1), Some("three"));
  assert_eq!(VariantStrIter::new(&v).last(), Some("four"));
  assert_eq!(VariantStrIter::new(&v).collect::<Vec<_>>(), vec!["zero", "one", "two", "three", "four"]);
}
`);
  function run(command, args) {
    const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', env: { ...process.env, TMPDIR: directory }, timeout: 60000 });
    assert.equal(result.status, 0, `${command}: ${result.stderr}\n${result.stdout}`);
  }
  run('cc', ['-O2', '-c', 'out.c', '-o', 'out.o']);
  run('rustc', ['--edition=2024', '-C', 'opt-level=3', 'iterator.rs', '-C', 'link-arg=out.o', '-o', 'iterator']);
  run(path.join(directory, 'iterator'), []);
});

test('Desktop SCA invokes its independent manifest and rejects scanner failures or unwaived findings', t => {
  const directory = fixture(t);
  for (const file of ['scripts/check-sca.mjs', 'scripts/sca-policy.mjs', 'scripts/glib-backport.mjs', 'security/sca-waivers.json', 'Cargo.lock', 'pnpm-lock.yaml', 'engines/uv.lock']) {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(directory, file));
  }
  fs.mkdirSync(path.join(directory, 'bin'));
  const binary = path.join(directory, 'bin/cargo');
  fs.writeFileSync(binary, `#!${process.execPath}
const fs = require('fs');
if (process.argv.includes('--version')) { console.log('cargo-deny 0.20.2'); process.exit(0); }
fs.writeFileSync('cargo-arguments.json', JSON.stringify(process.argv.slice(2)));
const response = JSON.parse(fs.readFileSync('response.json')); console.error(JSON.stringify(response.body)); process.exit(response.status);
`);
  fs.chmodSync(binary, 0o755);
  function run(command, args) { return spawnSync(command, args, { cwd: directory, encoding: 'utf8', env: { ...process.env, PATH: path.join(directory, 'bin') + ':' + process.env.PATH } }); }
  assert.equal(run('git', ['init', '-q']).status, 0);
  assert.equal(run('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'fixture']).status, 0);
  const response = (body, status) => fs.writeFileSync(path.join(directory, 'response.json'), JSON.stringify({ body, status }));
  const scan = () => run(process.execPath, ['scripts/check-sca.mjs', 'cargo-desktop']);
  response({ type: 'summary' }, 0);
  assert.equal(scan().status, 0);
  const args = JSON.parse(fs.readFileSync(path.join(directory, 'cargo-arguments.json'), 'utf8'));
  assert.deepEqual(args.slice(0, 3), ['deny', '--manifest-path', 'apps/terminal-desktop/src-tauri/Cargo.toml']);
  assert.ok(args.includes('--locked'));
  response({ fields: { severity: 'error', advisory: { id: 'RUSTSEC-FIXTURE' }, graphs: [{ Krate: { name: 'unsafe-fixture', version: '1.0.0' } }] } }, 1);
  assert.equal(scan().status, 1);
  response({ fields: { severity: 'error', message: 'unavailable scanner' } }, 1);
  assert.match(scan().stderr, /Non-waivable cargo scanner failure/);
  fs.unlinkSync(path.join(directory, 'third_party/rust/glib/src/variant_iter.rs'));
  assert.match(scan().stderr, /inventory mismatch/);
});
