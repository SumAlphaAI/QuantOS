export function validateA1Semantics(openapi,catalog,policy,workflow) {
 const failures=[];const check=(ok,message)=>{if(!ok)failures.push(message);};
 const schemas=openapi.components?.schemas??{};
 const resolve=value=>value?.$ref?value.$ref.split('/').slice(1).reduce((o,k)=>o?.[k],openapi):value;
 check(JSON.stringify(openapi.security)===JSON.stringify([{cookieAuth:[]}]),'A1 cookie authentication is mandatory');
 check(openapi.components?.securitySchemes?.cookieAuth?.in==='cookie','A1 session is a cookie');
 for(const [name,type,required]of [['IdempotencyKey','string',true],['IfMatch','string',true],['CsrfToken','string',true],['ClientRequestId','string',true],['Sort','string',false],['Filter','string',false],['AfterSequence','integer',false]]) {
  const p=openapi.components?.parameters?.[name];
  check(p?.schema?.type===type&&Boolean(p.required)===required,`${name} type/required semantics`);
 }
 check(schemas.DecimalValue?.type==='string'&&schemas.DecimalValue?.pattern==='^-?\\d+(\\.\\d+)?$','DecimalValue preserves exact decimal strings');
 check(schemas.StreamEvent?.properties?.payloadVersion?.type==='string'&&JSON.stringify(schemas.StreamEvent?.properties?.payloadVersion?.enum)===JSON.stringify(['v1','1']),'StreamEvent supports only frozen payload versions');
 check(schemas.StreamEvent?.properties?.sequence?.minimum===1,'StreamEvent positive sequence');
 for(const [id,entry]of Object.entries(catalog.contracts??{})) {
  check(JSON.stringify(entry.pages)===JSON.stringify(policy.contracts[id]?.pages),`${id} exact page ownership`);
  check(entry.ownerTask===policy.contracts[id]?.ownerTask,`${id} exact task ownership`);
 }
 for(const [path,item]of Object.entries(openapi.paths??{}))for(const [method,op]of Object.entries(item)) {
  if(!op.operationId)continue;
  const parameters=(op.parameters??[]).map(resolve).filter(Boolean);
  const has=name=>parameters.some(p=>p.name===name&&p.required===true);
  const write=['put','post','delete','patch'].includes(method);
  const auth=(op.security??openapi.security)?.length>0;
  if(write&&auth)check(has('X-CSRF-Token'),`${op.operationId} CSRF required`);
  if(write&&!policy.idempotencyExceptions.includes(op.operationId)) {
    check(has('Idempotency-Key')&&has('X-Request-Id'),`${op.operationId} idempotency/request ID required`);
  }
  if(op.requestBody) {
    const body=op.requestBody.content?.['application/json']?.schema;
    check(body?.additionalProperties===false,`${op.operationId} closes untrusted request fields`);
    check(op.requestBody.content?.['application/json']?.example!==undefined,`${op.operationId} request example`);
  }
  if(op.operationId==='decideApproval')check(op.requestBody.content['application/json'].schema.required.includes('reauthTokenRef'), 'approval requires recent authentication');
  check(Boolean(op.responses?.default),`${op.operationId} safe server error contract`);
  const p=op['x-quantos-policy'];
  check(p&&policy.requiredOperationPolicy.every(k=>p[k]!==undefined),`${op.operationId} complete policy`);
  if(parameters.some(p=>p.name==='cursor')) {
   if(op.operationId==='getEvidenceChain')check(!parameters.some(p=>['sort','filter'].includes(p.name))&&p?.sortFilterNotApplicable==='Evidence chain preserves causation order; filtering would remove required nodes', 'evidence chain explicitly preserves causation order');
   else check(parameters.some(p=>p.name==='sort')&&parameters.some(p=>p.name==='filter')&&p?.sort?.length&&p?.filter?.length,`${op.operationId} bounded sort/filter policy`);
  }
  for(const [status,raw]of Object.entries(op.responses??{})) {
    const response=resolve(raw);
    check(Boolean(response?.headers?.['X-Correlation-Id'])&&Boolean(response?.headers?.['Cache-Control']),`${op.operationId}/${status} correlation/cache headers`);
    if(/^2/.test(status)&&response?.content?.['application/json'])check(response.content['application/json'].example!==undefined,`${op.operationId} success example`);
  }
 }
 for(const id of ['getProfile','getNotificationPrefs','getStrategyDraft']) {
   const op=Object.values(openapi.paths).flatMap(Object.values).find(o=>o.operationId===id);
   check(Boolean(op?.responses?.['200']?.headers?.ETag),`${id} ETag is published`);
 }
 const active=command=>Object.values(workflow.jobs??{}).some(job=>job.if===undefined&&!job['continue-on-error']&&(job.steps??[]).some(step=>step.if===undefined&&!step['continue-on-error']&&String(step.run??'').split(/\s*&&\s*|\n/).map(s=>s.trim()).includes(command)));
 for(const command of ['pnpm check:bff-fe-000','pnpm test:bff-fe-000','pnpm check:bff-compatibility','pnpm test:bff-remediation'])check(active(command),`active CI step ${command}`);
 return failures;
}
