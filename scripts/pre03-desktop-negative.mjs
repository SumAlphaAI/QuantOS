import test from 'node:test';
import { mkdtempSync, copyFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { loadRuntimeInputs, validateRuntimeContract } from './pre03-smoke.mjs';
const current = await loadRuntimeInputs(undefined,{webOnly:false});
test('explicit second-phase Desktop contract remains valid',()=>assert.equal(validateRuntimeContract(current,{webOnly:false}).status,'PASS'));
test('Desktop artifact fork is rejected',()=>{
  const tauriConfig=structuredClone(current.tauriConfig);tauriConfig.build.frontendDist='../terminal-desktop/out';
  assert.equal(validateRuntimeContract({...current,tauriConfig},{webOnly:false}).status,'FAIL');
});
test('unsafe Desktop deep-link wiring is rejected',()=>{
  assert.equal(validateRuntimeContract({...current,rustMain:current.rustMain.replaceAll('sanitize_deep_link','unsafe_link')},{webOnly:false}).status,'FAIL');
});

test('explicit Desktop workspace and companion lock remain supported',async()=>{
  const root=resolve('.');const tmp=mkdtempSync(join(tmpdir(),'pre03-desktop-workspace-'));
  try {
    for(const dir of ['apps','packages','docs','node_modules'])symlinkSync(join(root,dir),join(tmp,dir),'dir');
    for(const file of ['package.json','.nvmrc','rust-toolchain.toml'])copyFileSync(join(root,file),join(tmp,file));
    copyFileSync(join(root,'pnpm-workspace.desktop.yaml'),join(tmp,'pnpm-workspace.yaml'));
    copyFileSync(join(root,'pnpm-lock.desktop.yaml'),join(tmp,'pnpm-lock.yaml'));
    const inputs=await loadRuntimeInputs(tmp,{webOnly:false});
    const report=validateRuntimeContract(inputs,{webOnly:false});
    assert.equal(report.status,'PASS',report.failures.join('\n'));
    assert.equal(validateRuntimeContract(inputs).status,'FAIL','Web default must reject Desktop workspace');
  } finally {rmSync(tmp,{recursive:true,force:true});}
});
