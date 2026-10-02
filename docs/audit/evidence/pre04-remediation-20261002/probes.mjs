import {writeFileSync} from 'node:fs';
import {loadPre04Inputs,validatePre04Inventory} from '../../../../scripts/pre04-inventory.mjs';
const current=loadPre04Inputs();const results=[];
function replace(text,from,to){if(!text.includes(from))throw Error('probe did not match: '+from);return text.replace(from,to);}
function probe(name,expected,mutate){const input=structuredClone(current);mutate(input);const report=validatePre04Inventory(input);results.push({name,expected,actual:report.status,behaves_as_expected:report.status===expected,failures:report.failures,metrics:{contracts:report.contracts,gaps:report.gaps,p0_pages:report.p0_pages,field_rows:report.field_rows}});}
probe('current-inventory','PASS',()=>{});
probe('duplicate-C01-row','FAIL',i=>{const row=i.ledger.split('\n').find(l=>l.startsWith('| C01 '));i.ledger=replace(i.ledger,row,row+'\n'+row);});
probe('duplicate-GAP01-row','FAIL',i=>{const row=i.gaps.split('\n').find(l=>l.startsWith('| GAP-01 '));i.gaps=replace(i.gaps,row,row+'\n'+row);});
probe('delete-required-C01-actorId-field','FAIL',i=>{const row=i.fields.split('\n').find(l=>l.startsWith('| SessionContext.actorId |'));i.fields=replace(i.fields,row+'\n','');});
probe('field-source-nonexistent','FAIL',i=>{i.fields=replace(i.fields,'bff:SessionContext.actorId','bff:DoesNotExist.actorId');});
probe('field-type-corrupted','FAIL',i=>{i.fields=replace(i.fields,'| SessionContext.actorId | {"$ref":"#/components/schemas/UUID"} | 是 |','| SessionContext.actorId | {"type":"boolean"} | 否 |');});
probe('gap-unowned-page-and-backend','FAIL',i=>{i.gaps=replace(i.gaps,'| P01、P15、GS、WEB-06、WEB-07 | F06、L03 |','| P99 | Z99 |');});
probe('gap-nonexistent-BFF-task','FAIL',i=>{i.gaps=replace(i.gaps,'| BFF-FE-001 |','| BFF-FE-999 |');});
probe('owner-nonexistent-role','FAIL',i=>{i.ledger=replace(i.ledger,'BFF TL + Auth owner（F06）','BFF TL + Nonexistent owner（Z99）');});
probe('unfrozen-C02-promoted-to-Implemented','FAIL',i=>{i.ledger=replace(i.ledger,'Inventory Fixture（未发布 OpenAPI；不得升级 Implemented）','Implemented；生产已验收');});
probe('manifest-path-method-corrupted','FAIL',i=>{i.manifest.operations[0].path='/nonexistent';i.manifest.operations[0].method='DELETE';});
probe('same-count-schema-renamed','FAIL',i=>{i.openapi.components.schemas.DoesNotExist=i.openapi.components.schemas.SessionContext;delete i.openapi.components.schemas.SessionContext;});
probe('same-count-proto-message-renamed','FAIL',i=>{i.protoSources=i.protoSources.map(s=>s.replace('message DataSnapshot {','message MissingSnapshot {'));});
probe('unknown-page-contract-control','FAIL',i=>{i.ledger=replace(i.ledger,'C01 session/context/capabilities','C99 session/context/capabilities');});
probe('missing-gap-control','FAIL',i=>{const row=i.gaps.split('\n').find(l=>l.startsWith('| GAP-13 '));i.gaps=replace(i.gaps,row+'\n','');});
writeFileSync(new URL('probes.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({probes:results.length,false_passes:results.filter(r=>r.expected==='FAIL'&&r.actual==='PASS').length,results},null,2));
