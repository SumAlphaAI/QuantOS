#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const openapi = YAML.parse(readFileSync(resolve(root, "bff/openapi/quantos-bff.v1.yaml"), "utf8"));
const catalog = YAML.parse(readFileSync(resolve(root, "bff/page-operation-catalog.yaml"), "utf8"));
const manifest = JSON.parse(readFileSync(resolve(root, "tests/contract/generated/quantos-bff.operations.json"), "utf8"));
const schemas = JSON.parse(readFileSync(resolve(root, "tests/contract/generated/quantos-bff.components.schema.json"), "utf8"));
const coverage = readFileSync(resolve(root, "docs/PRE-01-page-api-coverage-register.md"), "utf8");

const requiredTags = ["session", "research", "data", "strategy", "risk", "proposal", "approval", "execution", "settings", "audit"];
const sourceOperations = [];
for (const [path, pathItem] of Object.entries(openapi.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem ?? {})) {
    if (!operation?.operationId) continue;
    sourceOperations.push({ operationId: operation.operationId, method: method.toUpperCase(), path, tags: operation.tags ?? [] });
  }
}

const operationIds = new Set(sourceOperations.map((operation) => operation.operationId));
const generatedIds = new Set(manifest.operations.map((operation) => operation.operationId));
const failures = [];

for (const tag of requiredTags) {
  if (!sourceOperations.some((operation) => operation.tags.includes(tag))) failures.push(`G0 frozen tag has no operations: ${tag}`);
}
for (const id of operationIds) if (!generatedIds.has(id)) failures.push(`operation missing from generated manifest: ${id}`);
for (const id of generatedIds) if (!operationIds.has(id)) failures.push(`stale generated operation: ${id}`);
for (const name of Object.keys(openapi.components?.schemas ?? {})) {
  if (!schemas.$defs?.[name]) failures.push(`component missing from generated JSON Schema: ${name}`);
}

const referencedIds = new Set();
const plannedIds = new Set(Object.values(catalog.contracts ?? {}).flatMap((entry) => entry.plannedOperations ?? []));
const operationToken = /\b(?:get|list|search|create|save|run|submit|request|engage|release|decide|cancel|subscribe|revoke|setup|clear|check)[A-Z][A-Za-z0-9]*\b|\b(?:reauth|mfaChallenge|logout)\b/g;
for (const line of coverage.split("\n")) {
  if (!/^\| (?:GS|官网|P\d{2}) \|/.test(line)) continue;
  const operationCells = line.split("|").slice(3, 6).join(" ");
  for (const token of operationCells.match(operationToken) ?? []) {
    if (operationIds.has(token)) referencedIds.add(token);
    else if (!plannedIds.has(token)) failures.push(`page coverage references unknown operationId: ${token}`);
  }
}

for (const operation of sourceOperations) {
  if (!referencedIds.has(operation.operationId)) failures.push(`frozen operation has no page coverage reference: ${operation.operationId}`);
}

const forbiddenFiles = ["docs/PRE-01-page-api-coverage-register.md"];
for (const relative of forbiddenFiles) {
  const text = readFileSync(resolve(root, relative), "utf8");
  if (text.includes("1.0.0-transition")) failures.push(`${relative} still references transition schema`);
}

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`FAIL  ${failure}`));
  console.error(`\n${failures.length} BFF contract coverage failure(s).`);
  process.exit(1);
}

console.log(`BFF contract coverage passed: ${operationIds.size} operations, ${Object.keys(schemas.$defs).length} schemas, ${referencedIds.size} page references.`);
