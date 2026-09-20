import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const openApiDir = path.join(repoRoot, "proto", "openapi");
const schemaDir = path.join(repoRoot, "proto", "jsonschema");

if (!fs.existsSync(openApiDir)) {
  throw new Error("proto/openapi does not exist. Run buf generate first.");
}

const candidates = fs
  .readdirSync(openApiDir)
  .filter((entry) => entry.endsWith(".json"))
  .map((entry) => path.join(openApiDir, entry))
  .sort();

if (candidates.length === 0) {
  throw new Error("No OpenAPI JSON artifacts found in proto/openapi.");
}

const document = JSON.parse(fs.readFileSync(candidates[0], "utf8"));
const definitions = {
  ...(document.definitions ?? document.components?.schemas ?? {}),
};

function sourceBlock(source, kind, name) {
  const start = source.search(new RegExp(`\\b${kind}\\s+${name}\\s*\\{`));
  if (start < 0) {
    throw new Error(`Missing ${kind} ${name} in Proto source`);
  }
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`Unclosed ${kind} ${name} in Proto source`);
}

function schemaReference(type) {
  const typeName = type.split(".").at(-1);
  return {$ref: `#/definitions/v1${typeName}`};
}

function messageSchemaFromProto(source, name) {
  const properties = {};
  const required = [];
  for (const line of sourceBlock(source, "message", name).split("\n")) {
    const match = line.trim().match(
      /^(repeated\s+)?([.a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)\s*=\s*\d+(?:\s*\[(.*?)\])?;/,
    );
    if (!match) continue;
    const [, repeated, type, field, options = ""] = match;
    let value;
    if (type === "string" || type === "bytes") value = {type: "string"};
    else if (type === "bool") value = {type: "boolean"};
    else if (["double", "float"].includes(type)) value = {type: "number"};
    else if (["int32", "uint32", "sint32", "fixed32", "sfixed32"].includes(type)) {
      value = {type: "integer", format: "int32"};
    } else if (["int64", "uint64", "sint64", "fixed64", "sfixed64"].includes(type)) {
      value = {type: "string", format: "int64"};
    } else if (type === "google.protobuf.Timestamp") {
      value = {type: "string", format: "date-time"};
    } else {
      value = schemaReference(type);
    }
    properties[field] = repeated ? {type: "array", items: value} : value;
    if (options.includes("google.api.field_behavior") && options.includes("REQUIRED")) {
      required.push(field);
    }
  }
  return {type: "object", properties, ...(required.length > 0 ? {required} : {})};
}

function enumSchemaFromProto(source, name) {
  const values = [...sourceBlock(source, "enum", name).matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*\d+;/gm)].map(
    (match) => match[1],
  );
  if (values.length === 0) throw new Error(`Empty enum ${name} in Proto source`);
  return {type: "string", enum: values, default: values[0]};
}

// OpenAPI only contains service-reachable messages. Add planned domain types from
// their authoritative Proto source so schema coverage cannot depend on RPC reachability.
const strategySource = fs.readFileSync(
  path.join(repoRoot, "proto", "quantos", "strategy", "v1", "strategy.proto"),
  "utf8",
);
definitions.v1DeploymentTarget ??= enumSchemaFromProto(strategySource, "DeploymentTarget");
definitions.v1StrategyRelease ??= messageSchemaFromProto(strategySource, "StrategyRelease");

fs.mkdirSync(schemaDir, { recursive: true });

for (const entry of fs.readdirSync(schemaDir)) {
  if (entry.endsWith(".schema.json")) {
    fs.rmSync(path.join(schemaDir, entry));
  }
}

function referencedDefinitions(schema) {
  const selected = {};
  const pending = [schema];

  while (pending.length > 0) {
    const value = pending.pop();
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    if (value === null || typeof value !== "object") {
      continue;
    }
    if (typeof value.$ref === "string") {
      const match = value.$ref.match(/^#\/definitions\/([^/]+)$/);
      if (match) {
        const name = match[1];
        if (!(name in definitions)) {
          throw new Error(`Schema references missing definition: ${name}`);
        }
        if (!(name in selected)) {
          selected[name] = definitions[name];
          pending.push(definitions[name]);
        }
      }
    }
    pending.push(...Object.values(value));
  }

  return selected;
}

for (const [name, schema] of Object.entries(definitions)) {
  const cleanName = name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const outputPath = path.join(schemaDir, `${cleanName}.schema.json`);
  const payload = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://sumalpha.ai/schemas/${cleanName}.schema.json`,
    title: cleanName,
    ...schema,
  };
  const dependencies = referencedDefinitions(schema);
  if (Object.keys(dependencies).length > 0) {
    payload.definitions = dependencies;
  }
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
}

console.log(`Extracted ${Object.keys(definitions).length} JSON schema documents.`);
