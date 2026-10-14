import {spawnSync} from 'node:child_process';
import {staticEnvironment} from './provider-a1-receipts.mjs';
const files=['engines/vibe-adapter/src/vibe_adapter/rollout.py','engines/vibe-adapter/src/vibe_adapter/local_drill.py','engines/vibe-adapter/src/vibe_adapter/service.py','engines/vibe-adapter/src/vibe_adapter/server.py','engines/vibe-adapter/src/vibe_adapter/fixtures.py','engines/tests/test_vibe_adapter_rollout.py'];
const commands=[['engines/.venv/bin/ruff','check',...files],['engines/.venv/bin/ruff','format','--check',...files],['engines/.venv/bin/pyright','--project','engines','--pythonpath','engines/.venv/bin/python','engines/vibe-adapter/src','engines/tests/test_vibe_adapter_rollout.py']];
for(const command of commands){const r=spawnSync(command[0],command.slice(1),{env:staticEnvironment(process.env),encoding:'utf8',timeout:60000});process.stdout.write((r.stdout??'')+(r.stderr??''));if(r.status!==0||r.error||r.signal)process.exit(1);}
console.log('TP01-F local style PASS');
