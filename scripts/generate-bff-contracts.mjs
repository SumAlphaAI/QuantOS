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
