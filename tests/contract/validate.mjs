/**
 * Contract fixture 校验器（schema + 领域不变量 + 敏感字段负向扫描）。
 * 供 vitest 与 scripts/pre06-sabotage-check.mjs 共用，保证"故意破坏必被捕获"。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const dir = fileURLToPath(new URL(".", import.meta.url));
const ajv2020 = addFormats(new Ajv2020({ allErrors: true, strict: false }));
const generatedSchemas = JSON.parse(
  readFileSync(join(dir, "generated/quantos-bff.components.schema.json"), "utf8"),
);

const sensitive = JSON.parse(readFileSync(join(dir, "sensitive-fields.json"), "utf8"));
const SENSITIVE_PATTERNS = sensitive.forbiddenKeyPatterns.map((k) => k.toLowerCase());

const validators = new Map();
function validatorFor(schemaName) {
  if (!validators.has(schemaName)) {
    if (!generatedSchemas.$defs?.[schemaName]) throw new Error(`Unknown generated BFF schema: ${schemaName}`);
    validators.set(schemaName, ajv2020.compile({
      $schema: generatedSchemas.$schema,
      $ref: `#/$defs/${schemaName}`,
      $defs: generatedSchemas.$defs,
    }));
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
