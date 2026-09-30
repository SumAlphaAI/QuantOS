import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// A version-only exception is unsafe: require the complete patched source and
// the Desktop resolver to select that source before recognizing the backport.
export function verifyGlibBackport(root) {
  const document = JSON.parse(fs.readFileSync(path.join(root, 'security/glib-backport.json'), 'utf8'));
  const directory = path.join(root, 'third_party/rust/glib');
  if (document.package !== 'glib' || document.version !== '0.18.5' || document.advisory !== 'RUSTSEC-2024-0429') {
    throw Error('Invalid GLib backport identity');
  }
  const files = fs.readdirSync(directory, { recursive: true }).filter(file => fs.statSync(path.join(directory, file)).isFile()).sort();
  if (JSON.stringify(files) !== JSON.stringify(Object.keys(document.files).sort())) throw Error('GLib backport inventory mismatch');
  for (const file of files) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, file))).digest('hex');
    if (hash !== document.files[file]) throw Error(`GLib backport digest mismatch: ${file}`);
  }
  const source = fs.readFileSync(path.join(directory, 'src/variant_iter.rs'), 'utf8');
  if (!source.includes('let mut p: *mut libc::c_char = std::ptr::null_mut();') || !source.includes('                &mut p,')) {
    throw Error('GLib mutable out-pointer fix missing');
  }
  const manifest = fs.readFileSync(path.join(root, 'apps/terminal-desktop/src-tauri/Cargo.toml'), 'utf8');
  if (!/\[patch\.crates-io\]\s+glib = \{ path = "\.\.\/\.\.\/\.\.\/third_party\/rust\/glib" \}/.test(manifest)) throw Error('Desktop GLib patch missing');
  const lock = fs.readFileSync(path.join(root, 'apps/terminal-desktop/src-tauri/Cargo.lock'), 'utf8');
  const packages = lock.split('[[package]]').filter(block => /^\s*name = "glib"\n/m.test(block));
  if (packages.length !== 1 || !packages[0].includes('version = "0.18.5"') || /^(source|checksum) =/m.test(packages[0])) {
    throw Error('Desktop lock must select only the local patched GLib');
  }
  return { advisory: document.advisory, status: 'BACKPORT_VERIFIED', upstreamFix: document.upstreamFix, files: files.length };
}
