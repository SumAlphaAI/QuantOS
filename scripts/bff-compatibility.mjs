import { createHash } from 'node:crypto';
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ignored=key=>['description','summary','title','example','examples','info','servers','tags'].includes(key)||key.startsWith('x-');
// Preserve the existing whole-array correction receipts for every other change.
// Only an unchanged parameter set plus new optional inline inputs is additive.
function optionalParameterAddition(before,after) {
  const inline=p=>p&&typeof p==='object'&&!p.$ref&&typeof p.name==='string'&&['query','header','cookie','path'].includes(p.in);
  if(!before.every(inline)||!after.every(inline))return false;
  const key=p=>JSON.stringify([p.in,p.name]);
  if(new Set(before.map(key)).size!==before.length||new Set(after.map(key)).size!==after.length)return false;
  const previous=new Map(before.map(p=>[key(p),p]));
  return before.every(p=>after.some(q=>key(q)===key(p)&&digest(q)===digest(p)))&&after.every(p=>previous.has(key(p))||p.in!=='path'&&(p.required===false||p.required===undefined));
}
export function contractChanges(before,after,path='') {
  if(digest(before)===digest(after))return [];
  if(path.endsWith('/parameters')&&Array.isArray(before)&&Array.isArray(after)&&optionalParameterAddition(before,after))return [];
  if(path.endsWith('/allOf') && Array.isArray(before) && Array.isArray(after) && before.length===after.length) return before.flatMap((entry,index)=>contractChanges(entry,after[index],path+'/'+index));
  if(Array.isArray(before)||Array.isArray(after))return [{path,before,after}];
  if(before&&after&&typeof before==='object'&&typeof after==='object') {
    const changes=[];
    for(const key of new Set([...Object.keys(before),...Object.keys(after)])) {
      if(ignored(key))continue;
      const next=path+'/'+key.replaceAll('~','~0').replaceAll('/','~1');
      if(!(key in before)) {
        // New required/closed constraints affect existing callers. New paths,
        // response codes, headers and optional properties remain additive.
        if(['required','enum','pattern','minimum','maximum','minLength','maxLength','minItems','maxItems','oneOf','allOf','not'].includes(key)||key==='additionalProperties'&&after[key]===false||key==='parameters'&&after[key].some(p=>p.required||p.$ref))changes.push({path:next,before:null,after:after[key]});
      } else if(!(key in after))changes.push({path:next,before:before[key],after:null});
      else changes.push(...contractChanges(before[key],after[key],next));
    }
    return changes;
  }
  return [{path,before,after}];
}
export function validateCompatibility(before,after,decision,now=new Date().toISOString().slice(0,10)) {
  const changes=contractChanges(before,after);
  const approved=decision?.baselineDigest===digest(before)&&(decision?.candidateVersion===after.info.version||decision?.compatibleAdditiveVersions?.includes(after.info.version))&&
    decision?.expiresOn>=now&&decision?.admission==='ENGINEERING_ONLY_PENDING_A1' ? decision.changes : [];
  const failures=changes.filter(change=>!approved?.some(entry=>entry.path===change.path&&entry.beforeDigest===digest(change.before)&&entry.afterDigest===digest(change.after)));
  if(changes.length&&before.info.version===after.info.version)failures.push({path:'/info/version',before:before.info.version,after:after.info.version});
  return {status:failures.length?'FAIL':'PASS',changes:changes.length,registeredCorrections:changes.length-failures.length,failures};
}
