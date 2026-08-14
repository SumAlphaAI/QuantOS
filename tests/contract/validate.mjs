/**
 * Contract fixture 校验器（schema + 领域不变量 + 敏感字段负向扫描）。
 * 供 vitest 与 scripts/pre06-sabotage-check.mjs 共用，保证"故意破坏必被捕获"。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const dir = fileURLToPath(new URL(".", import.meta.url));
const ajvDraft7 = addFormats(new Ajv({ allErrors: true, strict: false }));
const ajv2020 = addFormats(new Ajv2020({ allErrors: true, strict: false }));

const SCHEMAS = {
  "command-center-view": "schemas/command-center-view.schema.json",
  "error-envelope": "schemas/error-envelope.schema.json",
  "trade-proposal": "../../proto/jsonschema/v1TradeProposal.schema.json",
};

const sensitive = JSON.parse(readFileSync(join(dir, "sensitive-fields.json"), "utf8"));
const SENSITIVE_PATTERNS = sensitive.forbiddenKeyPatterns.map((k) => k.toLowerCase());

const PROTO_SCHEMA_DIR = join(dir, "../../proto/jsonschema");

/** proto 提取的 schema 以 `#/definitions/<title>` 互引，需将全部 v1 schema 打包为 definitions。 */
let protoDefinitions;
function loadProtoDefinitions() {
  if (!protoDefinitions) {
    protoDefinitions = {};
    for (const file of readdirSync(PROTO_SCHEMA_DIR)) {
      if (!file.startsWith("v1") || !file.endsWith(".schema.json")) continue;
      const schema = JSON.parse(readFileSync(join(PROTO_SCHEMA_DIR, file), "utf8"));
      if (schema.title) {
        const { $id: _drop, ...rest } = schema; // 定义内嵌时去除 $id，保持 #/definitions 解析域
        protoDefinitions[schema.title] = rest;
      }
    }
  }
  return protoDefinitions;
}

const validators = new Map();
function validatorFor(schemaName) {
  if (!validators.has(schemaName)) {
    const schema = JSON.parse(readFileSync(join(dir, SCHEMAS[schemaName]), "utf8"));
    const ajv = String(schema.$schema ?? "").includes("2020-12") ? ajv2020 : ajvDraft7;
    let bundled = schema;
    if (schemaName === "trade-proposal") {
      const { $id: _drop, ...rest } = schema; // 避免与 definitions 内同名 $id 冲突
      bundled = { ...rest, definitions: loadProtoDefinitions() };
    }
    validators.set(schemaName, ajv.compile(bundled));
  }
  return validators.get(schemaName);
}

/** 递归扫描敏感字段 key。 */
function scanSensitiveKeys(value, path, issues) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanSensitiveKeys(v, `${path}[${i}]`, issues));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_PATTERNS.some((p) => k.toLowerCase().includes(p))) {
        issues.push(`敏感字段命中：${path}.${k}`);
      }
      scanSensitiveKeys(v, `${path}.${k}`, issues);
    }
  }
}

/**
 * 校验 fixture：schema（可选）+ 敏感字段 + 领域不变量。
 * @returns {string[]} issues，空数组即通过。
 */
export function validateFixture(fixture, { schema } = {}) {
  const issues = [];
  if (schema) {
    const validate = validatorFor(schema);
    if (!validate(fixture)) {
      for (const err of validate.errors ?? []) {
        issues.push(`schema: ${err.instancePath || "/"} ${err.message}`);
      }
    }
  }
  scanSensitiveKeys(fixture, "$", issues);
  // 领域不变量（A02）：TradeProposal 永远 executable=false
  if (fixture && typeof fixture === "object" && "executable" in fixture && fixture.executable !== false) {
    issues.push("领域不变量违反：TradeProposal.executable 必须恒为 false");
  }
  return issues;
}

export function loadFixture(relPath) {
  return JSON.parse(readFileSync(join(dir, "fixtures", relPath), "utf8"));
}
