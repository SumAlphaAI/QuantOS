// Contract shapes only, no fixture-derived business acceptance.
import {it,expect} from 'vitest';
import {validateFixture} from './validate.mjs';
const id='11111111-1111-4111-8111-111111111111',hash='sha256:'+'a'.repeat(64);
const receipt={requestId:id,commandId:id,subjectHash:hash,sourceHash:hash,entryHash:hash,sequence:1,state:'applied',reason:'OBSERVED_NATIVE_FACTS',observedFillIds:['fill:owned'],appliedFillIds:['fill:owned']};
const position={symbol:'BTCUSDT',quantity:'1',averageEntryPrice:'1000',realizedPnl:'-0.01'};
const view=()=>({schemaVersion:'quantos-native-ledger.v1',tenantId:id,workspaceId:id,accountId:id,quoteCurrency:'USDT',ledgerHash:hash,anchor:{sequence:1,head:hash},consumerReady:true,valuationReady:false,executionAuthority:false,scope:'OBSERVED_NATIVE_FILLS_ONLY',appliedFillCount:1,quarantinedCommandCount:0,quoteCashDelta:'-1000.01',quoteFeesTotal:'0.01',positions:[position],entries:[receipt]});
for(const[schema,value]of [['AssistedLedgerReceipt',receipt],['AssistedLedgerPosition',position],['AssistedLedgerView',view()]] as const)it('X01 contract accepts '+schema,()=>expect(validateFixture(value,{schema})).toEqual([]));
for(const[k,v]of [['executionAuthority',true],['valuationReady',true],['scope','FULL_ACCOUNT_EQUITY'],['quoteCurrency','USD'],['ledgerHash','unchecked'],['entries',[{...receipt,sourceHash:undefined}]]] as const)it('X01 contract rejects '+k,()=>expect(validateFixture({...view(),[k]:v},{schema:'AssistedLedgerView'}).length).toBeGreaterThan(0));
