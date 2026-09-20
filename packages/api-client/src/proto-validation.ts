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
  validateCommandMetadata(message.metadata ?? message.request?.metadata);
}
