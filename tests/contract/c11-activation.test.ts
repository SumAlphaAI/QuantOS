import {it,expect} from 'vitest';
import {validateFixture} from './validate.mjs';
import {activationView,activationEvent,id} from '../../apps/terminal/tests/fixtures/c11-activation';
it('validates scoped C11 view and explicit owned bootstrap origin',()=>expect(validateFixture(activationView,{schema:'AssistedActivationView'})).toEqual([]));
it('validates immutable paginated C11 history',()=>expect(validateFixture({resourceId:id,version:'0',totalCount:1,items:[activationEvent],nextCursor:null,executionAuthority:false},{schema:'AssistedActivationHistory'})).toEqual([]));
for(const[k,v]of [['executionAuthority',true],['unknownPreserved',false],['version',1],['version','01'],['mode','paper'],['featureKey','disable-kill-switch'],['tenantId',null],['secrets','forbidden']]as const)it('refuses C11 '+k,()=>expect(validateFixture({...activationView,[k]:v},{schema:'AssistedActivationView'}).length).toBeGreaterThan(0));
it('requires exact scoped activation intent',()=>expect(validateFixture({scope:{tenantId:id,workspaceId:id,accountId:id,mode:'assisted_live',featureKey:'execution.assisted-testnet'},enabled:false,validUntil:activationView.validUntil,reason:'pause',confirmPhrase:'DISABLE ASSISTED TESTNET',mfaChallengeRef:id,reauthTokenRef:id},{schema:'AssistedActivationAction'})).toEqual([]));
