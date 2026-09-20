import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CommandMetadataSchema,
  TradeCommandSchema,
  createApiClientName,
  createBffClient,
  MetadataValidationError,
  validateProtocolMessage,
} from "../src/index.js";

describe("api-client", () => {
  it("creates the default api client name", () => {
    expect(createApiClientName()).toBe("api-client");
  });

  it("roundtrips a trade command through the generated schema", () => {
    const command = create(TradeCommandSchema, {
      metadata: {
        requestId: "req-1",
        tenantId: "tenant-primary",
        workspaceId: "workspace-primary",
        actor: {
          actorId: "actor-1",
          actorKind: 1,
          displayName: "Tester",
          capabilities: ["research.run"],
        },
        correlationId: "corr-1",
        causationId: "cause-1",
        mode: 2,
        environment: 2,
        issuedAt: timestampFromDate(new Date("2026-01-01T00:00:00Z")),
      },
      commandId: "cmd-1",
      decisionId: "decision-1",
      accountId: "paper-account",
      venue: "binance",
      venueKind: 1,
      symbol: "BTCUSDT",
      intent: 2,
      side: 1,
      quantity: { value: "1.5" },
      limitPrice: { value: "65000.25" },
      idempotencyKey: "idem-1",
      expiresAt: timestampFromDate(new Date("2026-01-01T00:05:00Z")),
    });

    const bytes = toBinary(TradeCommandSchema, command);
    const decoded = fromBinary(TradeCommandSchema, bytes);

    expect(decoded.commandId).toBe("cmd-1");
    expect(decoded.metadata?.tenantId).toBe("tenant-primary");
    expect(decoded.idempotencyKey).toBe("idem-1");
  });

  it("marks core metadata fields as required in generated JSON schema", () => {
    const schemaPath = fileURLToPath(
      new URL(
        "../../../proto/jsonschema/v1CommandMetadata.schema.json",
        import.meta.url,
      ),
    );
    const parsed = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as {
      required: string[];
    };

    expect(parsed.required).toEqual(
      expect.arrayContaining([
        "request_id",
        "tenant_id",
        "workspace_id",
        "actor",
        "correlation_id",
        "mode",
        "environment",
        "issued_at",
      ]),
    );

    expect(CommandMetadataSchema.typeName).toBe("quantos.common.v1.CommandMetadata");
  });

  it("rejects protocol messages without complete security metadata", () => {
    const command = create(TradeCommandSchema, { commandId: "only-id" });
    expect(() => validateProtocolMessage(command)).toThrowError(MetadataValidationError);

    const complete = create(TradeCommandSchema, {
      metadata: {
        requestId: "request-1",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        actor: { actorId: "actor-1", actorKind: 1 },
        correlationId: "correlation-1",
        mode: 2,
        environment: 2,
        issuedAt: timestampFromDate(new Date("2026-01-01T00:00:00Z")),
      },
    });
    expect(() => validateProtocolMessage(complete)).not.toThrow();
    expect(() => validateProtocolMessage({ request: complete })).not.toThrow();
    expect(() => validateProtocolMessage({ request: {} })).toThrowError("metadata");

    const fields = [
      ["requestId", "metadata.request_id"],
      ["tenantId", "metadata.tenant_id"],
      ["workspaceId", "metadata.workspace_id"],
      ["correlationId", "metadata.correlation_id"],
    ] as const;
    const completeBytes = toBinary(TradeCommandSchema, complete);
    for (const [field, expected] of fields) {
      const invalid = fromBinary(TradeCommandSchema, completeBytes);
      invalid.metadata![field] = "";
      expect(() => validateProtocolMessage(invalid)).toThrowError(expected);
    }
  });

  it("uses the generated BFF contract with cookie credentials", async () => {
    const requests: Request[] = [];
    const client = createBffClient({
      baseUrl: "https://bff.test.invalid",
      fetch: async (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init);
        requests.push(request);
        return Response.json({
          actorId: "11111111-2222-4333-8444-555555555555",
          tenantId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          workspaceId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
          accountId: "6f708192-a3b4-4d5e-8f6a-7b8c9d0e1f2a",
          mode: "paper",
          environment: "staging",
          capabilities: [],
          mfaState: "verified",
          expiresAt: "2026-08-14T06:00:00Z",
        });
      },
    });

    const { data, error } = await client.GET("/v1/session");

    expect(error).toBeUndefined();
    expect(data?.mode).toBe("paper");
    expect(requests[0]?.url).toBe("https://bff.test.invalid/v1/session");
    expect(requests[0]?.credentials).toBe("include");
  });
});
