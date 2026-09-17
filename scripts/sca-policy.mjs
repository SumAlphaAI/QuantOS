import fs from 'node:fs';
export function validateWaivers(document,now=new Date()){
 if(!Array.isArray(document.waivers))throw Error('Missing waivers array');
 const ids=new Set();
 for(const w of document.waivers){
  for(const key of ['id','ecosystem','package','version','reason','owner','expiresOn'])if(typeof w[key]!=='string'||!w[key].trim())throw Error(`Waiver missing ${key}`);
  if(!['npm','pypi','cargo'].includes(w.ecosystem)||/[*>]/.test(w.id+w.package+w.version))throw Error('Waiver must identify an exact dependency/advisory');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(w.expiresOn))throw Error('Invalid waiver date');
  const date=new Date(w.expiresOn+'T00:00:00Z');
  if(Number.isNaN(date.valueOf())||date.toISOString().slice(0,10)!==w.expiresOn)throw Error('Invalid waiver date');
  if(now>=new Date(w.expiresOn+'T23:59:59.999Z'))throw Error(`Expired waiver: ${w.id}`);
  const key=[w.ecosystem,w.package,w.version,w.id].join(':');if(ids.has(key))throw Error('Duplicate waiver');ids.add(key);
 }
 return document.waivers;
}
export function adjudicate(findings,waivers,now=new Date()){
 validateWaivers({waivers},now);
 return findings.map(f=>({...f,waived:waivers.some(w=>w.ecosystem===f.ecosystem&&w.package===f.package&&w.version===f.version&&[f.id,...(f.aliases??[])].includes(w.id))}));
}
export function readWaivers(root){return validateWaivers(JSON.parse(fs.readFileSync(`${root}/security/sca-waivers.json`)));}
