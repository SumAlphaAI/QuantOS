import {it,expect} from 'vitest';
import {validateFixture} from './validate.mjs';
import {killView,killEvent,id} from '../../apps/terminal/tests/fixtures/native-kill-control';
it('current control status validates strict generated contract',()=>expect(validateFixture(killView,{schema:'AssistedKillView'})).toEqual([]));
it('immutable kill receipt validates current union alternative',()=>expect(validateFixture({schemaVersion:'quantos-current-kill-receipt.v1',event:killEvent,readCurrentState:true,executionAuthority:false},{schema:'AssistedKillReceipt'})).toEqual([]));
for(const [key,value] of [['executionAuthority',true],['unknownPreserved',false],['generation',1],['generation','01'],['nativeStopped',null],['accountId',null],['privateKey','forbidden']] as const)it('refuses current control '+key,()=>expect(validateFixture({...killView,[key]:value},{schema:'AssistedKillView'}).length).toBeGreaterThan(0));
it('versioned account intent retains exact original proof binding',()=>expect(validateFixture({scope:'account',accountId:id,expectedGeneration:'0',reason:'owned review',confirmPhrase:'ENGAGE ACCOUNT KILL',mfaChallengeRef:id,reauthTokenRef:id},{schema:'AssistedKillIntent'})).toEqual([]));
