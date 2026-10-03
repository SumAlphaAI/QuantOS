import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPre04Inputs, validatePre04Inventory } from './pre04-inventory.mjs';
const current = loadPre04Inputs();
function change(text, from, to) { assert(text.includes(from), `fixture mutation must match ${from}`); return text.replace(from, to); }
function rejected(mutate, message) {
  const input = structuredClone(current); mutate(input);
  const report = validatePre04Inventory(input);
  assert.equal(report.status, 'FAIL');
  if (message) assert(report.failures.some(failure => failure.includes(message)), report.failures.join('\n'));
}
function fieldMutation(input, alter) {
  const row = input.fields.split('\n').find(line => line.startsWith('| SessionContext.actorId |'));
  input.fields = change(input.fields, row, alter(row));
}

test('current full phase-one inventory passes', () => {
  const report = validatePre04Inventory(current);
  assert.equal(report.status, 'PASS', report.failures.join('\n'));
  assert.deepEqual([report.contracts, report.gaps, report.p0_pages, report.field_rows], [17, 17, 23, 413]);
});
test('missing Gap is rejected', () => rejected(i => {i.gaps = i.gaps.replace(/^\| GAP-13 \|.*\n/m, '');}, 'gap list contains'));
test('undecided realtime dependency is rejected', () => rejected(i => {i.ledger = change(i.ledger, 'C13 preflight/quote refresh', '待开发时再定');}, 'P20 Realtime dependency is explicit'));
test('deleted required actorId field is rejected', () => rejected(i => fieldMutation(i, () => ''), 'field dictionary exactly matches'));
test('nonexistent field source is rejected', () => rejected(i => {i.fields = change(i.fields, 'bff:SessionContext.actorId', 'bff:DoesNotExist.actorId');}, 'field dictionary exactly matches'));
test('wrong field type and optionality are rejected', () => rejected(i => fieldMutation(i, row => row.replace('{"$ref":"#/components/schemas/UUID"} | 是', '{"type":"boolean"} | 否')), 'field dictionary exactly matches'));
test('generated operation deletion is rejected', () => rejected(i => {i.manifest.operations.pop();}, 'generated operation manifest exactly matches'));
test('generated method and path drift are rejected', () => {
  for (const patch of [{method:'DELETE'}, {path:'/nonexistent'}]) rejected(i => Object.assign(i.manifest.operations[0], patch), 'generated operation manifest exactly matches');
});
test('same-count schema rename is rejected', () => rejected(i => {i.openapi.components.schemas.DoesNotExist = i.openapi.components.schemas.SessionContext;delete i.openapi.components.schemas.SessionContext;}, 'OpenAPI source identity'));
test('schema required and enum drift are rejected', () => {
  rejected(i => {i.openapi.components.schemas.SessionContext.required.pop();}, 'OpenAPI source identity');
  rejected(i => {i.openapi.components.schemas.ExportJob.properties.status.enum.pop();}, 'OpenAPI source identity');
});
test('same-count Proto message rename is rejected', () => rejected(i => {i.protoSources = i.protoSources.map(s => s.replace('message DataSnapshot {', 'message MissingSnapshot {'));}, 'Proto source identities'));
test('removed Proto declaration is rejected', () => rejected(i => {i.protoSources = i.protoSources.map(s => s.replace(/^message\s+\w+/m, '// removed declaration'));}, 'Proto source identities'));
test('same-count JSON Schema replacement is rejected', () => rejected(i => {const key = Object.keys(i.jsonSchemaFiles)[0]; i.jsonSchemaFiles[key] = '{}';}, 'JSON Schema identities'));
test('duplicate contract row is rejected before Map collapse', () => rejected(i => {const row = i.ledger.split('\n').find(l => l.startsWith('| C01 '));i.ledger = change(i.ledger, row, row+'\n'+row);}, 'contract ledger contains'));
test('duplicate Gap row is rejected before Map collapse', () => rejected(i => {const row = i.gaps.split('\n').find(l => l.startsWith('| GAP-01 '));i.gaps = change(i.gaps, row, row+'\n'+row);}, 'gap list contains'));
test('nonexistent role owner is rejected', () => rejected(i => {i.ledger = change(i.ledger, 'BFF TL + Auth owner（F06）', 'BFF TL + Nonexistent owner（Z99）');}, 'owners resolve'));
test('nonexistent backend task is rejected', () => rejected(i => {i.gaps = change(i.gaps, '| F06、L03 |', '| Z99 |');}, 'backend tasks resolve'));
test('nonexistent BFF task is rejected', () => rejected(i => {i.gaps = change(i.gaps, '| BFF-FE-001 |', '| BFF-FE-999 |');}, 'BFF tasks resolve'));
test('unknown Gap page is rejected', () => rejected(i => {i.gaps = change(i.gaps, '| P01、P15、GS、WEB-06、WEB-07 |', '| P99 |');}, 'pages resolve'));
test('each missing website P0 page is rejected', () => {
  for (const id of ['WEB-01','WEB-02','WEB-03','WEB-06','WEB-07']) rejected(i => {i.ledger = i.ledger.replace(new RegExp(`^\\| ${id} [^\\n]+\\n`, 'm'), '');}, 'full phase-one PRE-01 P0 page set');
});
test('missing auxiliary risk/audit/order contract is rejected', () => {
  for (const [from,to] of [['C07 proposal/evaluation context + ',''],[' + C09 linked order facts',''],[' + C10 audit/evidence chain','']]) rejected(i => {i.ledger = change(i.ledger, from, to);}, 'dependencies match reviewed');
});
test('closing partly published Gap is rejected', () => rejected(i => {const row = i.gaps.split('\n').find(l => l.startsWith('| GAP-04 '));i.gaps = change(i.gaps, row, row.replace('| Partial |','| Closed |'));}, 'status matches published/planned'));
test('omitting planned operation is rejected', () => rejected(i => {i.gaps = change(i.gaps, '未发布：getArtifactAttachment', '未发布：无');}, 'accounts exactly'));
test('unpublished Inventory Fixture cannot claim Implemented', () => rejected(i => {i.ledger = change(i.ledger, 'Inventory Fixture（未发布 OpenAPI；不得升级 Implemented）', 'Implemented；生产已验收');}, 'mock status matches'));
test('generated-only contract cannot claim Integrated', () => rejected(i => {i.ledger = change(i.ledger, 'Contract Mocked（已发布面同源生成 client/schema/MSW；未配置场景返回501；planned 能力未冻结）', 'Integrated；目标已验收');}, 'mock status matches'));
test('missing provider evidence is rejected', () => rejected(i => {delete i.evidenceFiles['services/bff-gateway/tests/auth_settings_provider.rs'];}, 'provider/test/historical receipt matches'));
test('changed provider receipt is rejected', () => rejected(i => {i.evidenceFiles['docs/audit/BFF-FE-007-acceptance-evidence-2026-09-16.md'] = 'PASS';}, 'provider/test/historical receipt matches'));
test('missing Inventory Fixture is rejected', () => rejected(i => {delete i.fixtureFiles['tests/contract/fixtures/command-center/default.json'];}, 'fixture exists'));
test('Desktop contamination is rejected by Web inventory', () => rejected(i => {i.gaps = change(i.gaps, '| P15、P17 |', '| P15、P16、P17 |');}, 'phase-one inventory excludes'));
test('nonexistent domain field mappings including the former engine-version anchor are rejected', () => {
  for (const [key, source] of [['Approval.originator', 'proto:common.v1.ActorRef.does_not_exist'], ['ResearchRun.engineVersion', 'proto:engine.v1.GetMetadataResponse.version']]) rejected(i => {i.baseline.domainMappings[key][0] = source;}, 'resolves domain source');
});
test('removed referenced core task is rejected', () => rejected(i => {i.corePlan = change(i.corePlan, '- task_id: `F06`', '- task_id: `Z99`');}, 'backend tasks resolve'));
test('catalog source drift is rejected', () => rejected(i => {i.catalog.contracts.C02.publishedOperations.push('getCommandSummary');}, 'operation catalog identity'));

test('empty implementation artifact lists are rejected for every implemented contract', () => {
  for (const id of Object.keys(current.baseline.implementations)) rejected(i => {i.baseline.implementations[id].artifacts = [];}, 'requires complete contract-specific');
});
test('each missing implementation evidence category is rejected', () => {
  for (const id of Object.keys(current.baseline.implementations)) for (let index = 0; index < 3; index++) rejected(i => {i.baseline.implementations[id].artifacts.splice(index, 1);}, 'requires complete contract-specific');
});
test('duplicate artifacts cannot substitute for test or receipt evidence', () => rejected(i => {
  i.baseline.implementations.C01.artifacts[1] = i.baseline.implementations.C01.artifacts[0];
}, 'requires complete contract-specific'));
test('another contract receipt cannot substitute for required evidence', () => rejected(i => {
  i.baseline.implementations.C01.artifacts = i.baseline.implementations.C10.artifacts;
}, 'requires complete contract-specific'));
test('unknown task suffixes are rejected in both backend task columns', () => {
  for (const key of ['ledger', 'gaps']) for (const suffix of ['BFF-FE-999', 'Z999', 'unknown']) rejected(i => {i[key] = change(i[key], '| F06、L03 |', `| F06、L03、${suffix} |`);}, 'backend tasks resolve');
});
test('ambiguous cross-prefix ranges cannot impersonate reviewed backend tasks', () => {
  for (const key of ['ledger', 'gaps']) rejected(i => {i[key] = change(i[key], '| S01、S02、S03、S04 |', '| S01–Z04 |');}, 'backend tasks resolve');
});
