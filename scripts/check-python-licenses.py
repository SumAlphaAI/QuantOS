"""Check every active locked dependency, including build/dev/security groups."""
import hashlib
import importlib.metadata as metadata
import json
import pathlib
import subprocess
from packaging.requirements import Requirement

root = pathlib.Path(__file__).resolve().parents[1]
out = root / 'artifacts/f02/python-licenses.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({'status': 'RUNNING'}))
classifier_map = {
    'MIT License': 'MIT', 'Apache Software License': 'Apache-2.0',
    'Mozilla Public License 2.0 (MPL 2.0)': 'MPL-2.0',
    'Python Software Foundation License': 'PSF-2.0',
    'The Unlicense (Unlicense)': 'Unlicense',
}
aliases = {'Apache License 2.0': 'Apache-2.0', 'Apache 2.0': 'Apache-2.0',
           '3-Clause BSD License': 'BSD-3-Clause', 'PSFL': 'PSF-2.0'}
try:
    exported = subprocess.check_output(['uv', 'export', '--locked', '--project', 'engines',
        '--all-packages', '--all-groups', '--no-emit-workspace', '--no-hashes'], cwd=root, text=True)
    rows = []
    for line in exported.splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        req = Requirement(line)
        if req.marker and not req.marker.evaluate():
            continue
        dist = metadata.distribution(req.name)
        if not req.specifier.contains(dist.version):
            raise RuntimeError(f'Installed version differs from lock: {req.name}')
        expression = dist.metadata.get('License-Expression') or dist.metadata.get('License')
        expression = aliases.get(expression, expression)
        if not expression or len(expression) > 100:
            labels = [c.split(' :: ')[-1] for c in dist.metadata.get_all('Classifier', [])]
            known = [classifier_map[c] for c in labels if c in classifier_map]
            expression = ' AND '.join(sorted(set(known))) if known else None
        if req.name == 'nodeenv' and dist.version == '1.10.0' and expression == 'BSD':
            # Ambiguous metadata is resolved only against a checked-in LICENSE digest.
            evidence = json.loads((root / 'security/python-license-evidence.json').read_text())['nodeenv@1.10.0']
            license_file = next(f for f in dist.files if str(f).endswith('/LICENSE'))
            if hashlib.sha256(dist.locate_file(license_file).read_bytes()).hexdigest() != evidence['sha256']:
                raise RuntimeError('nodeenv license evidence changed')
            expression = evidence['license']
        rows.append({'name': req.name, 'version': dist.version, 'license': expression})
    script = "import {allowed,licenseAllowed} from './scripts/license-policy.mjs';let s='';for await(const x of process.stdin)s+=x;console.log(JSON.stringify(JSON.parse(s).filter(p=>!licenseAllowed(p.license,allowed))));"
    result = subprocess.run(['node', '--input-type=module', '-e', script], input=json.dumps(rows), text=True, cwd=root, capture_output=True, check=True)
    denied = json.loads(result.stdout)
    receipt = {'lockSha256': hashlib.sha256((root / 'engines/uv.lock').read_bytes()).hexdigest(), 'status': 'FAIL' if denied else 'PASS', 'scope': 'all active locked dependency groups', 'packages': rows, 'failures': denied}
    out.write_text(json.dumps(receipt, indent=2) + '\n')
    if denied:
        raise RuntimeError(f'LICENSE_DENIED: {denied}')
    print(f'Licensed all {len(rows)} active locked Python dependencies')
except Exception as error:
    out.write_text(json.dumps({'status': 'FAIL', 'error': str(error)}, indent=2) + '\n')
    raise
