import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateFixture } from './validate.mjs';

export const openapi = YAML.parse(readFileSync(new URL('../../bff/openapi/quantos-bff.v1.yaml',import.meta.url),'utf8'));
const ajv=addFormats(new Ajv({allErrors:true,strict:false}));
const cache=new Map();
const components=openapi.components;
export const operations=new Map(Object.entries(openapi.paths).flatMap(([path,item])=>Object.entries(item)
  .filter(([,op])=>op.operationId).map(([method,op])=>[op.operationId,{...op,path,method}])));
const resolve=object=>object?.$ref ? object.$ref.split('/').slice(1).reduce((o,k)=>o[k],openapi) : object;
function validate(schema,value) {
  const key=JSON.stringify(schema);
  if(!cache.has(key))cache.set(key,ajv.compile({components,$ref:undefined,...schema}));
  const validator=cache.get(key);
  return validator(value)?[]:(validator.errors??[]).map(e=>`${e.instancePath}: ${e.message}`);
}
const issue=(status,message)=>({status,issues:[message]});
export async function validateRequest(id,request,params={}) {
  const op=operations.get(id);if(!op)throw Error('Unknown operation '+id);
  if(request.method.toLowerCase()!==op.method)return issue(405,'method mismatch');
  const url=new URL(request.url);
  const pattern=new RegExp('^'+op.path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\\\{([^}]+)\\\}/g,'([^/]+)')+'$');
  if(!pattern.test(url.pathname))return issue(404,'path mismatch');
  if((op.security??openapi.security).length&&!/(?:^|;\s*)quantos_session=[^;]+/.test(request.headers.get('cookie')??''))return issue(401,'cookie session required');
  if((op.security??openapi.security).length&&['post','put','patch','delete'].includes(op.method)) {
    const csrf=/(?:^|;\s*)quantos_csrf=([^;]+)/.exec(request.headers.get('cookie')??'')?.[1];
    if(!csrf||csrf!==request.headers.get('X-CSRF-Token')||!['http://localhost:3190',url.origin].includes(request.headers.get('origin')))return issue(403,'CSRF cookie/header and trusted origin required');
  }
  for(const raw of op.parameters??[]) {
    const p=resolve(raw);let value=p.in==='header'?request.headers.get(p.name):p.in==='path'?params[p.name]:url.searchParams.get(p.name);
    if(value==null){if(p.required)return issue(p.name==='X-CSRF-Token'?403:422,`required ${p.name}`);continue;}
    if(p.schema.type==='integer')value=Number(value);
    const issues=validate(p.schema,value);if(issues.length)return {status:422,issues};
  }
  for(const [parameter,allowed]of [['sort',op['x-quantos-policy']?.sort],['filter',op['x-quantos-policy']?.filter]]) {
    const value=url.searchParams.get(parameter);if(!value)continue;
    const parts=value.split(':');
    if(!allowed?.includes(parts[0])||parameter==='sort'&&(parts.length!==2||!['asc','desc'].includes(parts[1]))||parameter==='filter'&&(parts.length<3||parts[1]!=='eq'||!parts.slice(2).join(':')))return issue(422,'unsupported sort/filter');
  }
  if(op.requestBody) {
    const text=await request.clone().text();
    if(new TextEncoder().encode(text).length>op['x-quantos-policy'].limits.bodyBytes)return issue(422,'body too large');
    let body;try{body=JSON.parse(text);}catch{return issue(422,'invalid JSON body');}
    const issues=validate(op.requestBody.content['application/json'].schema,body);
    if(issues.length)return {status:422,issues};
  } else if(await request.clone().text())return issue(422,'unexpected request body');
  return {status:200,issues:[]};
}
export async function validateResponse(id,response) {
  const op=operations.get(id);const r=resolve(op.responses[String(response.status)]??op.responses.default);
  if(!r)return ['undeclared response status'];
  const issues=[];
  for(const [name,raw]of Object.entries(r.headers??{})) {
    const value=response.headers.get(name);if(value===null)issues.push('missing response header '+name);
    else issues.push(...validate(resolve(raw).schema,value));
  }
  if(response.status===204){if(await response.clone().text())issues.push('204 response has a body');return issues;}
  const media=r.content?.['application/json'];
  if(media) {
    if(!response.headers.get('content-type')?.includes('application/json'))issues.push('response media type mismatch');
    try {const body=await response.clone().json();issues.push(...validate(media.schema,body),...validateFixture(body));
      if(body?.correlationId&&body.correlationId!==response.headers.get('X-Correlation-Id'))issues.push('correlation header/body mismatch');
    }
    catch {issues.push('invalid response JSON');}
  }
  return issues;
}
export function checkedResolvers(resolvers) {
  const completed=new Map();
  return Object.fromEntries(Object.entries(resolvers).map(([id,resolver])=>[id,async context=>{
    const request=await validateRequest(id,context.request,context.params);
    if(request.issues.length)return Response.json({code:request.status===401?'UNAUTHENTICATED':'INVALID_REQUEST',message:'请求未通过契约校验。',correlationId:'11111111-1111-4111-8111-111111111111'},
      {status:request.status,headers:{'X-Correlation-Id':'11111111-1111-4111-8111-111111111111','Cache-Control':'no-store'}});
    const key=context.request.headers.get('Idempotency-Key');
    const cacheKey=key?JSON.stringify([id,context.request.headers.get('cookie'),key]):null;
    const fingerprint=JSON.stringify([context.request.url,await context.request.clone().text()]);
    const previous=cacheKey&&completed.get(cacheKey);
    if(previous) {
      if(previous.fingerprint===fingerprint)return previous.response.clone();
      return Response.json({code:'IDEMPOTENCY_CONFLICT',message:'幂等键已用于不同请求。',correlationId:'11111111-1111-4111-8111-111111111111'},{status:409,headers:{'X-Correlation-Id':'11111111-1111-4111-8111-111111111111','Cache-Control':'no-store'}});
    }
    const response=await resolver(context);
    const issues=await validateResponse(id,response);if(issues.length)throw Error(`${id} provider response violates OpenAPI: ${issues.join('; ')}`);
    if(cacheKey&&response.ok)completed.set(cacheKey,{fingerprint,response:response.clone()});
    return response;
  }]));
}
