// Typed wire models only; no fixture is counted as current business acceptance.
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {bffZodSchemas} from '../../packages/api-client/src/bff-gen/quantos-bff.zod';
import {validateFixture} from './validate.mjs';
const d='docs/audit/evidence/core-x01-valuation-local-20261029/preflight/';
const flow=JSON.parse(readFileSync(d+'valuation.json','utf8')),unknown=JSON.parse(readFileSync(d+'unknown.json','utf8'));
const copy=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
for(const [name,value,schema]of [['ready',flow.ready,'NativeValuationView'],['missing mark',flow.missing,'NativeValuationView'],['expired',flow.expired,'NativeValuationView'],['UNKNOWN',unknown.view,'NativeValuationView'],['snapshot',flow.ready.snapshot,'NativeRiskInputSnapshot'],['position',flow.ready.snapshot.positions[0],'NativeValuationPosition']]as const)it('valuation wire accepts '+name,()=>{expect(validateFixture(value,{schema})).toEqual([]);});
for(const[key,value]of [['executionAuthority',true],['equity',10099.99],['sourceHash','unchecked'],['killGeneration',0],['sourceTrust','REAL_MARKET_AUTHORIZED'],['sourceVersion',0],['positions',[{...flow.ready.snapshot.positions[0],markObservedAt:'invalid'}]]]as const)it('valuation snapshot rejects '+key,()=>{expect(validateFixture({...flow.ready.snapshot,[key]:value},{schema:'NativeRiskInputSnapshot'}).length).toBeGreaterThan(0);});
for(const[name,edit]of [['missing snapshot',(v:typeof flow.ready)=>{delete v.snapshot;}],['UNKNOWN carries old snapshot',(v:typeof flow.ready)=>{v.riskInputReady=false;v.reason='UNKNOWN_OR_QUARANTINED_OBLIGATIONS';}],['ready reason on blocked',(v:typeof flow.ready)=>{v.riskInputReady=false;delete v.snapshot;}],['ready with quarantine',(v:typeof flow.ready)=>{v.quarantinedCommandCount=1;}],['fabricated private extra source',(v:typeof flow.ready)=>{v.accountSecret='forbidden';}]]as const)it('valuation discriminated response rejects '+name,()=>{const v=copy(flow.ready);edit(v);expect(validateFixture(v,{schema:'NativeValuationView'}).length).toBeGreaterThan(0);expect(bffZodSchemas.NativeValuationView.safeParse(v).success).toBe(false);});
