#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$(uname -s)-$(uname -m)" in
 Linux-x86_64) file=gitleaks_8.28.0_linux_x64.tar.gz;;
 Darwin-arm64) file=gitleaks_8.28.0_darwin_arm64.tar.gz;;
 *) echo 'Unsupported pinned Gitleaks platform' >&2; exit 1;;
esac
scratch="$(mktemp -d)";trap 'rm -rf "$scratch"' EXIT
curl --fail --silent --show-error --location --retry 2 --max-time 300 "https://github.com/gitleaks/gitleaks/releases/download/v8.28.0/$file" -o "$scratch/$file"
node --input-type=module - "$root" "$scratch/$file" "$file" <<'JS'
import fs from 'node:fs';import crypto from 'node:crypto';
const [root,file,name]=process.argv.slice(2);
const expected=JSON.parse(fs.readFileSync(`${root}/security/tool-checksums.json`))[name];
if(!expected||crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==expected)throw Error('Gitleaks checksum mismatch');
JS
mkdir -p "$root/artifacts/tools"
tar -xzf "$scratch/$file" -C "$root/artifacts/tools" gitleaks
"$root/artifacts/tools/gitleaks" version
