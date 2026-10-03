import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bffZodSchemas, bffResponseSchemas } from "../src/bff-gen/quantos-bff.zod.js";
import { parseBffResponse, type BffOperationId } from "../src/bff-response.js";

type Schema = {
  $ref?: string; type?: string; format?: string; pattern?: string;
  enum?: unknown[]; allOf?: Schema[]; properties?: Record<string, Schema>;
  additionalProperties?: Schema | boolean; items?: Schema; minimum?: number;
  minLength?: number; minItems?: number;
};
const components = JSON.parse(readFileSync(new URL("../../../tests/contract/generated/quantos-bff.components.schema.json", import.meta.url), "utf8")) as { $defs: Record<string, Schema> };
const uuid = "11111111-1111-4111-8111-111111111111";

// Build specimens from the independently published JSON Schema, including
// optional fields and populated lists, so nested response validation executes.
function specimen(schema: Schema): unknown {
  if (schema.$ref) return specimen(components.$defs[schema.$ref.split("/").at(-1)!]);
  if (schema.allOf) return Object.assign({}, ...schema.allOf.map(specimen));
  if (schema.enum) return schema.enum[0];
  if (schema.type === "array") return Array.from({ length: Math.max(1, schema.minItems ?? 0) }, () => specimen(schema.items ?? {}));
  if (schema.type === "object" || schema.properties) {
    const value = Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, child]) => [key, specimen(child)]));
    if (typeof schema.additionalProperties === "object") value.extension = specimen(schema.additionalProperties);
    return value;
  }
  if (schema.type === "integer" || schema.type === "number") return Math.max(1, schema.minimum ?? 0);
  if (schema.type === "boolean") return true;
  if (schema.type === "string") {
    if (schema.format === "uuid") return uuid;
    if (schema.format === "date-time") return "2026-10-03T00:00:00Z";
    if (schema.format === "email") return "fixture@example.invalid";
    if (schema.format === "uri") return "https://example.invalid/resource";
    if (schema.pattern === "^[A-Z]{3}$") return "USD";
    if (schema.pattern?.includes("sha256:")) return "sha256:" + "a".repeat(64);
    if (schema.pattern?.includes("a-f0-9")) return "a".repeat(64);
    if (schema.pattern?.includes("2[0-3]")) return "12:00";
    if (schema.pattern === "^/") return "/fixture";
    if (schema.pattern) return "1";
    return "fixture".repeat(Math.ceil((schema.minLength ?? 1) / 7));
  }
  return {};
}

describe("published BFF runtime response coverage", () => {
  it("validates populated specimens for every component and rejects invalid types", () => {
    expect(Object.keys(bffZodSchemas)).toHaveLength(52);
    for (const [name, schema] of Object.entries(bffZodSchemas)) {
      const value = specimen(components.$defs[name]);
      expect(schema.safeParse(value).success, name).toBe(true);
      expect(schema.safeParse(null).success, name).toBe(false);
    }
  });

  it("rejects malformed success/error payloads for all published operations", () => {
    expect(Object.keys(bffResponseSchemas)).toHaveLength(62);
    for (const [operation, responses] of Object.entries(bffResponseSchemas)) {
      for (const [status, schema] of Object.entries(responses)) {
        if (status === "204") expect(schema.safeParse(undefined).success).toBe(true);
        else if (status !== "default") expect(() => parseBffResponse(operation as BffOperationId, Number(status), null), operation + ":" + status).toThrow();
      }
      const error = { code: "SERVICE_UNAVAILABLE", message: "Retry later", correlationId: uuid, retryAfter: 2 };
      expect(parseBffResponse(operation as BffOperationId, 599, error)).toEqual(error);
      expect(() => parseBffResponse(operation as BffOperationId, 599, { ...error, retryAfter: "2" })).toThrow();
    }
  });
});
