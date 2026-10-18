import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import YAML from 'yaml';
import {operations} from './bff-fe-003-development.mjs';
const read=p=>readFileSync(p,'utf8'),api=YAML.parse(read('bff/openapi/quantos-bff.v1.yaml')),catalog=YAML.parse(read('bff/page-operation-catalog.yaml'));
const published=['C03','C04'].flatMap(c=>{assert.equal(catalog.contracts[c].ownerTask,'BFF-FE-003');assert.deepEqual(catalog.contracts[c].plannedOperations,[]);return catalog.contracts[c].publishedOperations;});assert.deepEqual([...published].sort(),[...operations].sort());
const specs=new Map();for(const[path,item]of Object.entries(api.paths))for(const[method,op]of Object.entries(item))if(op?.operationId)specs.set(op.operationId,{path,method,op});
for(const id of operations){const s=specs.get(id);assert(s);assert(s.op.responses['401']&&s.op.responses['403']);assert(!s.op.security||s.op.security.some(s=>s.cookieAuth));if(s.method==='post')for(const name of ['CsrfToken','IdempotencyKey','ClientRequestId'])assert(s.op.parameters.some(p=>p.$ref?.endsWith('/'+name)),id+' '+name);}
const live=read('services/bff-gateway/src/live/research.rs');for(const token of ['TrustedIdentity','enqueue_research','request_research_cancel','load_authorized_snapshot','PgResearchArtifactRepository','record.artifact_manifest.artifact_id','scope(&identity.0)'])assert(live.includes(token),'direct adapter boundary missing '+token);
const pg=read('crates/quantos-runtime/src/research_pg.rs');assert(pg.includes('canonical_json_bytes(&record.output)'));assert(pg.includes('validate_record(&run, &record)'));
const bridge=read('supabase/migrations/20261006130000_bff_settings_audit_bridge.sql');assert(bridge.includes('after insert on quantos.bff_settings_audits'));assert(bridge.includes('audit_entries'));
console.log('BFF003 direct boundary PASS: 9 C03/C04 operations; trusted identity, scheduling/cancel, snapshot policy, artifact bytes and F05 audit bridge static only; target NOT_RUN');
