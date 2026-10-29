// Shape fixtures only; actual native/mTLS source evidence is collected separately.
import {it,expect} from 'vitest';
import {validateFixture} from './validate.mjs';
const id='11111111-1111-4111-8111-111111111111',hash='sha256:'+'a'.repeat(64),time='2026-10-29T00:00:00Z';
const order={orderId:'order:owned',commandId:id,accountId:id,symbol:'BTCUSDT',side:'buy',quantity:'1',filledQuantity:'1',averageFillPrice:'1000',status:'filled',submittedAt:time,updatedAt:time};
const fill={fillId:'fill:owned',orderId:order.orderId,commandId:id,accountId:id,symbol:'BTCUSDT',side:'buy',quantity:'1',price:'1000',feeCurrency:'USDT',feeAmount:'0.1',filledAt:time,factHash:hash};
const facts=()=>({schemaVersion:'quantos-native-execution-facts.v1',requestId:id,subjectHash:hash,tenantId:id,workspaceId:id,accountId:id,commandId:id,decisionId:id,proposalHash:hash,quoteCurrency:'USDT',outcome:'accepted',journalAvailable:true,consumerReady:true,reason:'OBSERVED_NATIVE_FACTS',order,fills:[fill],factHashes:[hash],nativeSourceHashes:[hash],sourceHash:hash,recordedAt:time,executionAuthority:false});
for(const[schema,v]of [['AssistedObservedOrder',order],['AssistedObservedFill',fill],['AssistedExecutionFacts',facts()]] as const)it('X04 generated contract accepts exact decimal '+schema,()=>expect(validateFixture(v,{schema})).toEqual([]));
for(const[k,v]of [['executionAuthority',true],['quoteCurrency','USD'],['sourceHash','unchecked'],['fills',[{...fill,feeAmount:undefined}]]] as const)it('X04 generated facts contract rejects '+k,()=>{expect(validateFixture({...facts(),[k]:v},{schema:'AssistedExecutionFacts'}).length).toBeGreaterThan(0);});
