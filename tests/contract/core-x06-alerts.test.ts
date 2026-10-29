import {it,expect} from 'vitest';
import {validateFixture} from './validate.mjs';
import {alert} from '../../apps/terminal/tests/fixtures/core-x06-alert';
it('accepts current OPEN read-only Assisted alert with complete X05 provenance',()=>expect(validateFixture(alert,{schema:'OpsAlert'})).toEqual([]));
for(const [key,value]of [['sourceEvidence',undefined],['readOnly',false],['resolved',true],['status','acked'],['ackAt','2026-10-29T00:00:00Z'],['active',false],['objectRef','/operations/health'],['mode','live']] as const)it('refuses Assisted alert '+key,()=>expect(validateFixture({...alert,[key]:value},{schema:'OpsAlert'}).length).toBeGreaterThan(0));
