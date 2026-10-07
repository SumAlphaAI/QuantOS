
// Preserve validation-relevant constraints; descriptions belong to the source link.
export function schemaShape(value) {
  if (Array.isArray(value)) return value.map(schemaShape);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['description', 'title', 'example', 'examples'].includes(key))
    .map(([key, entry]) => [key, schemaShape(entry)]));
  return value;
}
function objectFields(schema, schemas, visited = new Set()) {
  if (!schema) throw new Error('Missing schema');
  if (schema.$ref) {
    const name = schema.$ref.split('/').at(-1);
    if (visited.has(name)) throw new Error(`Cyclic object composition: ${name}`);
    return objectFields(schemas[name], schemas, new Set([...visited, name]));
  }
  const properties = { ...schema.properties }; const required = new Set(schema.required ?? []);
  for (const part of schema.allOf ?? []) {
    const fields = objectFields(part, schemas, visited);
    Object.assign(properties, fields.properties); for (const key of fields.required) required.add(key);
  }
  return { properties, required };
}
const cell = value => String(value).replaceAll('|', '&#124;').replaceAll('\n', ' ');
export function renderFieldDictionary(inputs) {
  const { baseline, openapi, catalog } = inputs; const schemas = openapi.components.schemas;
  const lines = ['# PRE-04 字段字典', '', '> 版本：1.2；日期：2026-10-02；范围：一期官网与 Web Terminal。',
    '> 由 `scripts/pre04-fields.mjs` 渲染；控制来源：[盘点基线](./PRE-04-inventory-baseline.json)、[OpenAPI](../../bff/openapi/quantos-bff.v1.yaml)、[operation catalog](../../bff/page-operation-catalog.yaml)。', '',
    '## 1. 字段与来源口径', '',
    '已发布字段以 OpenAPI 的 wire 名称、required 和完整约束为准；`$ref` 指向同文件 schema。领域字段与 HTTP 字段不同，由 transport/BFF 转换，页面不手写 DTO。`proto:` 是可解析的领域锚；“页面模型新增”不声称存在同名 Proto。', '',
    '`planned:` 指盘点基线中的字段决策，并由 catalog 的后续任务承接；它不是已发布 schema。计划字段已有名称/类型/必需性决策，发布时必须补 wire schema 与映射；未发布能力不得升级为 Implemented/Integrated。', '',
    '类型列为 schema 约束的 JSON 摘要（省略说明文案，保留枚举、范围、格式及嵌套 required）；可选不等于允许 null。完整说明见源 OpenAPI。', '',
    '命令领域元数据见 `proto/quantos/common/v1/common.proto:CommandMetadata`；tenant/workspace/actor 由受信会话注入，客户端不可伪造。HTTP 请求以对应 operation 为准，不要求浏览器传递整个领域元数据。Decimal/Money 保留精确值，UTC 时间、Idempotency-Key、版本/409、错误 correlation、未知枚举阻断与敏感字段规则沿用执行计划 §5.3–5.6。', '',
    '### 共享 wire 类型', '', '| Schema | 完整类型约束摘要 |', '|---|---|'];
  const claimed = new Set(Object.values(baseline.contracts).flatMap(c => c.models));
  for (const [name, schema] of Object.entries(schemas)) if (!claimed.has(name)) lines.push(`| ${name} | ${cell(JSON.stringify(schemaShape(schema)))} |`);
  let count = 0;
  const addObject = (name, schema, source) => {
    const fields = objectFields(schema, schemas);
    for (const [field, value] of Object.entries(fields.properties)) {
      const mapping = baseline.domainMappings[`${name}.${field}`];
      const domain = mapping?.[0] ?? 'none'; const note = mapping?.[1] ?? '页面模型新增/服务读模型；不声明同名 Proto 字段';
      lines.push(`| ${name}.${cell(field)} | ${cell(JSON.stringify(schemaShape(value)))} | ${fields.required.has(field) ? '是' : '否'} | ${cell(domain)} | ${cell(note)} | ${cell(source(field))} |`); count += 1;
    }
  };
  let index = 2;
  for (const [id, contract] of Object.entries(baseline.contracts)) {
    lines.push('', `## ${index++}. ${id} ${contract.name}`, '', '| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |', '|---|---|---|---|---|---|');
    for (const name of contract.models) addObject(name, schemas[name], field => `bff:${name}.${field}`);
    for (const operationId of catalog.contracts[id].publishedOperations) {
      for (const pathItem of Object.values(openapi.paths)) for (const operation of Object.values(pathItem)) {
        if (operation?.operationId !== operationId) continue;
        const request = operation.requestBody?.content?.['application/json']?.schema;
        if (request && !request.$ref) addObject(`${operationId}.request`, request, field => `bff:operation:${operationId}.request.${field}`);
      }
    }
    for (const [number, field] of contract.plannedFields.entries()) {
      lines.push(`| ${cell(field.name)} | ${cell(field.type)} | ${cell(field.required)} | ${cell(field.domain)} | PLANNED：${catalog.contracts[id].ownerTask} 冻结后同步 wire 映射 | planned:${id}.plannedFields.${number} |`); count += 1;
    }
    const pending = catalog.contracts[id].plannedOperations;
    if (pending.length) lines.push('', `尚未发布 operation：${pending.join('、')}；责任任务 ${catalog.contracts[id].ownerTask}。以上已发布字段不能用于证明这些 operation 的请求、响应或实时载荷已冻结。`);
  }
  lines.push('', '## 19. 完备性与验收边界', '', `- 共 ${count} 行契约字段（展开后的 wire 属性与计划字段行）；共享 schema 摘要另计，不沿用旧144行口径。`,
    '- 必填字段、可选字段、请求与响应按真实 schema 区分；SSE 信封为共享 StreamEvent，载荷版本和实时恢复仍按各 operation 规则执行。',
    '- 已发布部分只证明仓库契约；未配置生成式 MSW 返回501。本地参考 provider 不替代 staging、真实数据库/身份/对象存储或正式签署。',
    '- 当前一期不包含原生控制面；原生接口独立见 [DESK-PRE-04 承接表](./DESK-PRE-04-interface-transfer.md)。', '');
  return { markdown: lines.join('\n'), fieldRows: count };
}
