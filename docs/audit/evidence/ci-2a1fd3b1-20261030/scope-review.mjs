import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import YAML from 'yaml';
const base='2a1fd3b14719b173212904bcf8fab4d7432551ce';
const before=YAML.parse(execFileSync('git',['show',`${base}:bff/openapi/quantos-bff.v1.yaml`],{encoding:'utf8'}));
const after=YAML.parse(fs.readFileSync('bff/openapi/quantos-bff.v1.yaml','utf8'));
assert.deepEqual(after.components,before.components);
const normalized=structuredClone(after), additions=[];
for(const [path,item] of Object.entries(before.paths))for(const [method,old]of Object.entries(item)){
 if(!old?.operationId)continue;
 const next=normalized.paths[path][method];
 if(old.requestBody && !Object.hasOwn(old.requestBody.content['application/json'],'example'))delete next.requestBody.content['application/json'].example;
 for(const [code,response]of Object.entries(old.responses)){
  const n=next.responses[code];
  if(n.description!==response.description){assert.equal(n.description,response.description+'; example is an illustrative reference shape, not signed live evidence');n.description=response.description;}
  if(!Object.hasOwn(response,'headers')&&Object.hasOwn(n,'headers')){additions.push(old.operationId);delete n.headers;}
  if(response.content?.['application/json']&&!Object.hasOwn(response.content['application/json'],'example'))delete n.content['application/json'].example;
 }
 if(!Object.hasOwn(old['x-quantos-policy']??{},'sortFilterNotApplicable'))delete next['x-quantos-policy']?.sortFilterNotApplicable;
}
assert.deepEqual(normalized,before);
const baselinePath='docs/execution/PRE-04-inventory-baseline.json';
const oldBaseline=JSON.parse(execFileSync('git',['show',`${base}:${baselinePath}`],{encoding:'utf8'}));
const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
for(const key of ['version','date','revisionEvidence','revisionScope'])baseline[key]=oldBaseline[key];
assert.equal(baseline.sourceDigests.length,oldBaseline.sourceDigests.length);
for(let i=0;i<baseline.sourceDigests.length;i++)if(baseline.sourceDigests[i].path==='bff/openapi/quantos-bff.v1.yaml')baseline.sourceDigests[i].sha256=oldBaseline.sourceDigests[i].sha256;
assert.deepEqual(baseline,oldBaseline);
const review={schema:'quantos-ci-scope-review/v1',base,wireSchemasParametersSecurityAndExistingPolicyUnchanged:true,componentSchemas:180,operations:160,addedHeaderOperationIds:additions,baselineOnlyCurrentOpenApiDigestAndRevisionMetadataChanged:true,historicalProviderAndTargetAcceptanceUnchanged:true,reviewedSourceSha:null};
fs.writeFileSync('/tmp/quantos-2a1fd3b1-scope-review.json',JSON.stringify(review,null,2)+'\n');
console.log(JSON.stringify(review,null,2));
