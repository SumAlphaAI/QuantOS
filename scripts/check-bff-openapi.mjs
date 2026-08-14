#!/usr/bin/env node
/**
 * BFF OpenAPI 基线结构校验：
 * 1) YAML 可解析且为 OpenAPI 3.1；
 * 2) 全部本地 $ref 可解析；
 * 3) operationId 全局唯一；
 * 4) 每个 operation 有 tag 与至少一个 2xx 响应；
 * 5) 命令类 operation（post）均要求 Idempotency-Key（kill-switch/decisions 等），SSE 端点提供 afterSequence。
 */
import { readFileSync } from "node:fs";
import YAML from "yaml";

const file = process.argv[2] ?? "bff/openapi/quantos-bff.v1.yaml";
const doc = YAML.parse(readFileSync(file, "utf8"));
let failures = 0;
const fail = (m) => { failures += 1; console.error(`FAIL  ${m}`); };
const pass = (m) => console.log(`ok    ${m}`);

if (String(doc.openapi).startsWith("3.1")) pass(`OpenAPI 版本 ${doc.openapi}`);
else fail(`OpenAPI 版本异常：${doc.openapi}`);

// 本地 $ref 完整性（递归扫描）
const missing = [];
const walk = (node, path) => {
  if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (k === "$ref" && typeof v === "string" && v.startsWith("#/components/")) {
      const parts = v.split("/"); // ["#","components","<kind>","<name>"]
      const kind = parts[2];
      const name = parts[3];
      if (!doc.components?.[kind]?.[name]) missing.push(`${v}（${path}）`);
    } else walk(v, `${path}.${k}`);
  }
};
walk(doc.paths, "paths");
walk(doc.components, "components");
if (missing.length === 0) pass("全部本地 $ref 可解析");
else missing.forEach((m) => fail(`$ref 无法解析：${m}`));

// operationId 唯一 + tag + 2xx 响应
const seen = new Set();
let opCount = 0;
for (const [path, item] of Object.entries(doc.paths)) {
  for (const [method, op] of Object.entries(item)) {
    opCount += 1;
    const id = op.operationId ?? "(missing)";
    if (seen.has(id)) fail(`operationId 重复：${id}`);
    seen.add(id);
    if (!op.tags?.length) fail(`${id} 缺 tag`);
    if (!Object.keys(op.responses ?? {}).some((c) => c.startsWith("2"))) fail(`${id} 缺 2xx 响应`);
    // 业务命令类 POST 必须要求 Idempotency-Key（auth 交互与访问申请除外——其幂等由 challenge/限流保证）
    if (method === "post" && !path.startsWith("/v1/auth/") && path !== "/v1/access-requests") {
      const hasIdem = (op.parameters ?? []).some((p) => p.$ref?.endsWith("/IdempotencyKey"));
      if (!hasIdem) fail(`${id}（POST）缺 Idempotency-Key`);
    }
    // SSE 端点：响应含 text/event-stream 的 GET 必须有 afterSequence 参数
    const isSse = Object.values(op.responses ?? {}).some((r) => r.content?.["text/event-stream"]);
    if (method === "get" && isSse) {
      const hasAfter = (op.parameters ?? []).some((p) => p.$ref?.endsWith("/AfterSequence"));
      if (!hasAfter) fail(`${id}（SSE）缺 afterSequence`);
    }
  }
}
pass(`operation 数 ${opCount}，operationId 全局唯一`);

if (failures > 0) {
  console.error(`\n${failures} 项校验失败`);
  process.exit(1);
}
console.log("\nBFF OpenAPI 基线结构校验通过");
