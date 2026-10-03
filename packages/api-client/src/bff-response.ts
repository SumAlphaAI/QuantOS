import { bffResponseSchemas } from "./bff-gen/quantos-bff.zod.js";
import type { ZodType } from "zod";

export type BffOperationId = keyof typeof bffResponseSchemas;

export class BffResponseError extends Error {
  constructor(readonly operation: BffOperationId, readonly status: number) {
    super("BFF response does not match the published contract");
    this.name = "BffResponseError";
  }
}

/** Runtime validation is generated from operation responses, including inline schemas. */
export function parseBffResponse(operation: BffOperationId, status: number, value: unknown): unknown {
  const schemas = bffResponseSchemas[operation] as Record<string, ZodType>;
  const schema = schemas[String(status)] ?? schemas.default;
  const result = schema?.safeParse(value);
  if (!result?.success) throw new BffResponseError(operation, status);
  return result.data;
}
