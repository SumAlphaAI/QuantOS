// Schema fixtures only; actual current-source execution is sealed separately.
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {validateFixture} from './validate.mjs';
const p=JSON.parse(readFileSync('docs/audit/evidence/core-x02-books-risk-local-20261030/preflight/accepted.json','utf8'));
for(const[schema,value]of [['BooksRiskInput',p.review.booksAdmission.input],['BooksRiskAdmission',p.review.booksAdmission],['NativeRiskReviewView',p.review],['AssistedRequestView',p.original]]as const)it('accepts actual books-bound '+schema,()=>expect(validateFixture(value,{schema})).toEqual([]));
for(const[k,v]of [['sourceVersion',0],['ledgerHash','unchecked'],['openObligations',-1],['unknownObligations',-1],['callerFinancialOverride',true]]as const)it('refuses invalid books wire '+k,()=>expect(validateFixture({...p.review.booksAdmission.input,[k]:v},{schema:'BooksRiskInput'}).length).toBeGreaterThan(0));
for(const[k,v]of [['reason','REAL_VENUE_READY'],['executionAuthority',true],['inputHash','unchecked']]as const)it('refuses admission promotion '+k,()=>expect(validateFixture({...p.review.booksAdmission,[k]:v},{schema:'BooksRiskAdmission'}).length).toBeGreaterThan(0));
