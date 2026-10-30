import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {validateFixture} from './validate.mjs';
const p=JSON.parse(readFileSync('docs/audit/evidence/core-x01-r01-provenance-local-20261030/preflight/accepted-04.json','utf8'));
for(const [schema,v]of [['NativeValuationView',p.valuation],['NativeRiskInputSnapshot',p.valuation.snapshot],['R01ValuationProvenance',p.valuation.marketProvenance],['NativeRiskReviewView',p.risk],['NativeSubjectRiskBinding',p.risk.subject.nativeRiskBinding],['AssistedRequestView',p.original],['AssistedCurrentExecutionBinding',p.command.currentRisk]]as const)it('accepts current owned R01-shaped '+schema,()=>expect(validateFixture(v,{schema})).toEqual([]));
for(const [field,value]of [['purpose','research'],['trust','REAL_MARKET'],['artifactVersion',0],['policyRevision',65],['priceScale',19],['artifactHash','unbound'],['validUntil','forever'],['signer','self-declared']]as const)it('rejects provenance promotion '+field,()=>expect(validateFixture({...p.valuation.marketProvenance,[field]:value},{schema:'R01ValuationProvenance'}).length).toBeGreaterThan(0));
