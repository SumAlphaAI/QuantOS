#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(repoRoot, "bff/openapi/quantos-bff.v1.yaml");
const GENERATED_FILES = {
  types: "packages/api-client/src/bff-gen/quantos-bff.ts",
  zod: "packages/api-client/src/bff-gen/quantos-bff.zod.ts",
  schemas: "tests/contract/generated/quantos-bff.components.schema.json",
  operations: "tests/contract/generated/quantos-bff.operations.json",
  handlers: "tests/contract/generated/quantos-bff.msw.ts",
};

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function rewriteComponentRefs(value) {
  if (Array.isArray(value)) return value.map(rewriteComponentRefs);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (key === "$ref" && typeof child === "string") {
      return [key, child.replace(/^#\/components\/schemas\//, "#/$defs/")];
    }
    return [key, rewriteComponentRefs(child)];
  }));
}

function zodSchema(schema) {
  if (!schema || Object.keys(schema).length === 0) return "z.unknown()";
  if (schema.$ref) return `z.lazy(() => ${schema.$ref.split("/").at(-1)}Schema)`;

  let expression;
  if (schema.allOf?.length) {
    expression = schema.allOf.map(zodSchema).reduce((left, right) => `z.intersection(${left}, ${right})`);
  } else if (schema.oneOf?.length || schema.anyOf?.length) {
    const alternatives = (schema.oneOf ?? schema.anyOf).map(zodSchema);
    expression = alternatives.length === 1 ? alternatives[0] : `z.union([${alternatives.join(", ")}])`;
  } else if (schema.enum?.length) {
    expression = schema.enum.every((value) => typeof value === "string")
      ? schema.enum.length === 1
        ? `z.literal(${JSON.stringify(schema.enum[0])})`
        : `z.enum(${JSON.stringify(schema.enum)})`
      : schema.enum.length === 1
        ? `z.literal(${JSON.stringify(schema.enum[0])})`
        : `z.union([${schema.enum.map((value) => `z.literal(${JSON.stringify(value)})`).join(", ")}])`;
  } else if (schema.type === "string") {
    expression = "z.string()";
    if (schema.format === "uuid") expression += ".uuid()";
    else if (schema.format === "date-time") expression += ".datetime({ offset: true })";
    else if (schema.format === "email") expression += ".email()";
    else if (schema.format === "uri") expression += ".url()";
    if (schema.pattern) expression += `.regex(new RegExp(${JSON.stringify(schema.pattern)}))`;
    if (schema.minLength !== undefined) expression += `.min(${schema.minLength})`;
    if (schema.maxLength !== undefined) expression += `.max(${schema.maxLength})`;
  } else if (schema.type === "integer" || schema.type === "number") {
    expression = schema.type === "integer" ? "z.number().int()" : "z.number()";
    if (schema.minimum !== undefined) expression += `.min(${schema.minimum})`;
    if (schema.maximum !== undefined) expression += `.max(${schema.maximum})`;
  } else if (schema.type === "boolean") {
    expression = "z.boolean()";
  } else if (schema.type === "array") {
    expression = `z.array(${zodSchema(schema.items)})`;
    if (schema.minItems !== undefined) expression += `.min(${schema.minItems})`;
    if (schema.maxItems !== undefined) expression += `.max(${schema.maxItems})`;
  } else if (schema.type === "object" || schema.properties || schema.additionalProperties) {
    const required = new Set(schema.required ?? []);
    const properties = Object.entries(schema.properties ?? {}).map(([name, property]) => {
      const rendered = zodSchema(property);
      return `  ${JSON.stringify(name)}: ${required.has(name) ? rendered : `${rendered}.optional()`},`;
    });
    if (properties.length === 0 && schema.additionalProperties && typeof schema.additionalProperties === "object") {
      expression = `z.record(z.string(), ${zodSchema(schema.additionalProperties)})`;
    } else {
      expression = `z.object({\n${properties.join("\n")}\n})`;
      if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        expression += `.catchall(${zodSchema(schema.additionalProperties)})`;
      } else if (schema.additionalProperties === false) {
        expression += ".strict()";
      }
    }
  } else {
    expression = "z.unknown()";
  }

  if (schema.nullable) expression = `${expression}.nullable()`;
  if (schema.description) expression += `.describe(${JSON.stringify(schema.description)})`;
  return expression;
}

function renderZod(schemas, version) {
  const declarations = Object.entries(schemas).map(([name, schema]) =>
    `export const ${name}Schema = ${zodSchema(schema)};`,
  );
  const registry = Object.keys(schemas).map((name) => `  ${name}: ${name}Schema,`).join("\n");
  return `/* eslint-disable */\n` +
    `// Generated from bff/openapi/quantos-bff.v1.yaml (${version}). Do not edit.\n` +
    `import { z } from "zod";\n\n` +
    `${declarations.join("\n\n")}\n\n` +
    `export const bffZodSchemas = {\n${registry}\n} as const;\n`;
}

function responseSchemaName(operation) {
  for (const [status, response] of Object.entries(operation.responses ?? {})) {
    if (!String(status).startsWith("2")) continue;
    const ref = response?.content?.["application/json"]?.schema?.$ref;
    if (typeof ref === "string") return ref.split("/").at(-1) ?? null;
  }
  return null;
}

function operationsFrom(doc) {
  const operations = [];
  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!HTTP_METHODS.has(method)) continue;
      operations.push({
        operationId: operation.operationId,
        method: method.toUpperCase(),
        path,
        tags: operation.tags ?? [],
        responseSchema: responseSchemaName(operation),
        sse: Object.values(operation.responses ?? {}).some(
          (response) => response?.content?.["text/event-stream"],
        ),
      });
    }
  }
  return operations.sort((a, b) => a.operationId.localeCompare(b.operationId));
}

function renderMsw(operations, version) {
  const lines = operations.map((operation) => {
    const method = operation.method.toLowerCase();
    const path = operation.path.replace(/\{([^}]+)\}/g, ":$1");
    return `  http.${method}(\`${"${baseUrl}"}${path}\`, async ({ request, params }) => {\n` +
      `    const resolver = resolvers.${operation.operationId};\n` +
      "    if (resolver) return resolver({ request, params });\n" +
      `    return missingResolver("${operation.operationId}");\n` +
      "  }),";
  });

  return `/* eslint-disable */\n` +
    `// Generated from bff/openapi/quantos-bff.v1.yaml (${version}). Do not edit.\n` +
    `import { http, HttpResponse, type PathParams } from "msw";\n\n` +
    `export interface BffMockResolverContext {\n  request: Request;\n  params: PathParams;\n}\n\n` +
    `export type BffMockResolver = (context: BffMockResolverContext) => Response | Promise<Response>;\n` +
    `export type BffMockResolvers = Partial<Record<BffOperationId, BffMockResolver>>;\n\n` +
    `export type BffOperationId =\n${operations.map((o) => `  | "${o.operationId}"`).join("\n")};\n\n` +
    `function missingResolver(operationId: BffOperationId): Response {\n` +
    `  return HttpResponse.json(\n` +
    `    { code: "MOCK_NOT_CONFIGURED", message: \`No fixture configured for \${operationId}.\`, correlationId: "00000000-0000-4000-8000-000000000000" },\n` +
    `    { status: 501 },\n  );\n}\n\n` +
    `export function createGeneratedBffHandlers(\n` +
    `  resolvers: BffMockResolvers,\n` +
    `  baseUrl = "http://localhost:4010",\n` +
    `) {\n  return [\n${lines.join("\n")}\n  ];\n}\n`;
}

export function generatedBffFiles() {
  return Object.values(GENERATED_FILES);
}

export function generateBffContracts(outputRoot = repoRoot) {
  const doc = YAML.parse(readFileSync(source, "utf8"));
  const operations = operationsFrom(doc);

  const typesPath = join(outputRoot, GENERATED_FILES.types);
  ensureParent(typesPath);
  execFileSync(join(repoRoot, "node_modules/.bin/openapi-typescript"), [source, "-o", typesPath], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  const schemaDocument = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://quantos.sumalpha.ai/schemas/bff/${doc.info.version}/components.json`,
    title: `${doc.info.title} component schemas`,
    $defs: rewriteComponentRefs(doc.components?.schemas ?? {}),
  };

  const outputs = {
    [GENERATED_FILES.zod]: renderZod(doc.components?.schemas ?? {}, doc.info.version),
    [GENERATED_FILES.schemas]: json(schemaDocument),
    [GENERATED_FILES.operations]: json({
      source: "bff/openapi/quantos-bff.v1.yaml",
      openapi: doc.openapi,
      version: doc.info.version,
      operations,
    }),
    [GENERATED_FILES.handlers]: renderMsw(operations, doc.info.version),
  };

  for (const [relative, content] of Object.entries(outputs)) {
    const destination = join(outputRoot, relative);
    ensureParent(destination);
    writeFileSync(destination, content);
  }

  console.log(`Generated BFF ${doc.info.version}: ${operations.length} operations, ${Object.keys(doc.components?.schemas ?? {}).length} schemas.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputIndex = process.argv.indexOf("--output-root");
  const outputRoot = outputIndex >= 0 ? resolve(process.argv[outputIndex + 1]) : repoRoot;
  generateBffContracts(outputRoot);
}
