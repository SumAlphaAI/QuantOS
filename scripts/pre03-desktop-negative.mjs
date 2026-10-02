import test from 'node:test';
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
