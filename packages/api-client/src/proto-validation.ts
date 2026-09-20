import type { CommandMetadata } from "./gen/quantos/common/v1/common_pb.js";

export class MetadataValidationError extends Error {
  constructor(readonly field: string) {
    super(`required command metadata field is missing or invalid: ${field}`);
    this.name = "MetadataValidationError";
  }
}

function requireText(value: string, field: string): void {
  if (value.trim().length === 0) throw new MetadataValidationError(field);
}

export function validateCommandMetadata(
  metadata: CommandMetadata | undefined,
): asserts metadata is CommandMetadata {
  if (metadata === undefined) throw new MetadataValidationError("metadata");
  requireText(metadata.requestId, "metadata.request_id");
  requireText(metadata.tenantId, "metadata.tenant_id");
  requireText(metadata.workspaceId, "metadata.workspace_id");
  requireText(metadata.correlationId, "metadata.correlation_id");
  if (metadata.actor === undefined) throw new MetadataValidationError("metadata.actor");
  requireText(metadata.actor.actorId, "metadata.actor.actor_id");
  if (metadata.actor.actorKind === 0) {
    throw new MetadataValidationError("metadata.actor.actor_kind");
  }
  if (metadata.mode === 0) throw new MetadataValidationError("metadata.mode");
  if (metadata.environment === 0) throw new MetadataValidationError("metadata.environment");
  if (metadata.issuedAt === undefined) throw new MetadataValidationError("metadata.issued_at");
}

export function validateProtocolMessage(message: {
  metadata?: CommandMetadata | undefined;
  request?: { metadata?: CommandMetadata | undefined } | undefined;
}): void {
  const value = message as typeof message & { $typeName?: string; signal?: typeof message; event?: typeof message; events?: (typeof message)[]; payload?: { value?: typeof message } };
  if (value.$typeName === "quantos.engine.v1.StreamExecuteRequest" || "request" in value) {
    if (!value.request) throw new MetadataValidationError("request");
    validateProtocolMessage(value.request);
    return;
  }
  validateCommandMetadata(value.metadata);
  for (const [type, field] of [["quantos.trading.v1.TradeProposal", "signal"], ["quantos.events.v1.GetEventResponse", "event"]] as const) {
    if (value.$typeName === type && value[field] === undefined) throw new MetadataValidationError(field);
  }
  for (const child of [value.signal, value.event, value.payload?.value, ...(value.events ?? [])]) {
    if (child !== undefined) validateProtocolMessage(child);
  }
}
