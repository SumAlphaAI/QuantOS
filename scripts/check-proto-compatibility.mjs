import {spawnSync} from "node:child_process";
import path from "node:path";

import {create, equals, fromBinary, toBinary} from "@bufbuild/protobuf";
import {timestampFromDate} from "@bufbuild/protobuf/wkt";

import {validateProtocolMessage} from "../packages/api-client/dist/src/proto-validation.js";
import {
  DataSnapshotSchema,
  ResearchArtifactSchema,
} from "../packages/api-client/dist/src/gen/quantos/research/v1/research_pb.js";
import {
  SignalSchema,
  StrategyReleaseSchema,
} from "../packages/api-client/dist/src/gen/quantos/strategy/v1/strategy_pb.js";
import {
  FillSchema,
  OrderSchema,
  PositionSchema,
  RiskDecisionSchema,
  TradeCommandSchema,
  TradeProposalSchema,
} from "../packages/api-client/dist/src/gen/quantos/trading/v1/trading_pb.js";
import {EventEnvelopeSchema} from "../packages/api-client/dist/src/gen/quantos/events/v1/events_pb.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const fixtures = [];

function metadata(index) {
  return {
    requestId: `request-${index}`,
    tenantId: "tenant-primary",
    workspaceId: "workspace-primary",
    actor: {
      actorId: `actor-${index}`,
      actorKind: 1,
      displayName: "Compatibility Tester",
      capabilities: ["research.run", "trading.review"],
    },
    correlationId: `correlation-${index}`,
    causationId: `causation-${index}`,
    mode: 2,
    environment: 2,
    issuedAt: timestampFromDate(new Date((1_700_000_000 + index) * 1000)),
  };
}

function position(index) {
  return {
    metadata: metadata(index),
    positionId: `position-${index}`,
    accountId: "paper-account",
    symbol: "BTCUSDT",
    side: 1,
    quantity: {value: String(index + 1)},
    asOf: timestampFromDate(new Date((1_700_000_100 + index) * 1000)),
  };
}

const fixtureTypes = [
  ["DataSnapshot", DataSnapshotSchema, (index) => ({
    metadata: metadata(index), snapshotId: `snapshot-${index}`, schemaVersion: "v1", quality: 2,
    capturedAt: timestampFromDate(new Date((1_700_000_100 + index) * 1000)),
  })],
  ["ResearchArtifact", ResearchArtifactSchema, (index) => ({
    metadata: metadata(index), artifactId: `artifact-${index}`, title: `Research ${index}`,
    contentHash: `sha256:${index}`, createdAt: timestampFromDate(new Date((1_700_000_100 + index) * 1000)),
  })],
  ["StrategyRelease", StrategyReleaseSchema, (index) => ({
    metadata: metadata(index), releaseId: `release-${index}`, strategyId: `strategy-${index}`,
    name: "compatibility strategy", allowedTargets: [2],
    createdAt: timestampFromDate(new Date((1_700_000_100 + index) * 1000)),
  })],
  ["Signal", SignalSchema, (index) => ({
    metadata: metadata(index), signalId: `signal-${index}`, strategyReleaseId: `release-${index}`,
    symbol: "BTCUSDT", direction: 1, strength: {value: "0.8"}, confidence: {value: "0.9"},
  })],
  ["TradeProposal", TradeProposalSchema, (index) => ({
    metadata: metadata(index), proposalId: `proposal-${index}`, accountId: "paper-account",
    symbol: "BTCUSDT", action: 1, quantity: {value: String(index + 1)}, executable: false,
  })],
  ["RiskDecision", RiskDecisionSchema, (index) => ({
    metadata: metadata(index), decisionId: `decision-${index}`, proposalId: `proposal-${index}`,
    verdict: 1, signer: "risk-engine",
  })],
  ["TradeCommand", TradeCommandSchema, (index) => ({
    metadata: metadata(index), commandId: `command-${index}`, decisionId: `decision-${index}`,
    accountId: "paper-account", venue: "binance", venueKind: 1, symbol: "BTCUSDT",
    intent: 2, side: index % 2 === 0 ? 1 : 2, quantity: {value: String(index + 1)},
    limitPrice: {value: "65000.25"}, idempotencyKey: `idempotency-${index}`,
    expiresAt: timestampFromDate(new Date((1_700_010_000 + index) * 1000)),
  })],
  ["Order", OrderSchema, (index) => ({
    metadata: metadata(index), orderId: `order-${index}`, commandId: `command-${index}`,
    accountId: "paper-account", symbol: "BTCUSDT", side: 1, intent: 2,
    quantity: {value: String(index + 1)}, status: 1,
  })],
  ["Fill", FillSchema, (index) => ({
    metadata: metadata(index), fillId: `fill-${index}`, orderId: `order-${index}`,
    venueFillId: `venue-fill-${index}`, symbol: "BTCUSDT", quantity: {value: String(index + 1)},
    price: {value: "65000.25"},
  })],
  ["Position", PositionSchema, position],
  ["EventEnvelope", EventEnvelopeSchema, (index) => ({
    metadata: metadata(index), eventId: `event-${index}`, kind: 9,
    aggregateId: `position-${index}`,
    occurredAt: timestampFromDate(new Date((1_700_000_200 + index) * 1000)),
    payload: {case: "position", value: position(index)},
  })],
];

for (let index = 0; index < 1000 * fixtureTypes.length; index += 1) {
  const [typeName, schema, build] = fixtureTypes[index % fixtureTypes.length];
  const message = create(schema, build(index));
  validateProtocolMessage(message);
  fixtures.push(`${typeName}\t${Buffer.from(toBinary(schema, message)).toString("hex")}`);
}

const schemasByName = new Map(fixtureTypes.map(([name, schema]) => [name, schema]));
const consumers = [
  {
    name: "Python",
    command: "uv",
    args: [
      "run",
      "--locked",
      "--project",
      "engines",
      "--all-packages",
      "python",
      "scripts/proto-compat-python.py",
    ],
  },
  {
    name: "Rust",
    command: "cargo",
    args: ["run", "--quiet", "-p", "quantos-proto", "--example", "proto_compat"],
  },
];

function exchange(consumer, source, inputFixtures) {
  const result = spawnSync(consumer.command, consumer.args, {
    cwd: root,
    encoding: "utf8",
    input: `${inputFixtures.join("\n")}\n`,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `${consumer.name} compatibility consumer failed (${result.status}): ${result.error?.message ?? result.stderr}`,
    );
  }
  const returned = result.stdout.trim().split("\n");
  if (returned.length !== fixtures.length) {
    throw new Error(
      `${consumer.name} returned ${returned.length} fixtures; expected ${fixtures.length}`,
    );
  }
  for (let index = 0; index < fixtures.length; index += 1) {
    const [expectedType, expectedHex] = fixtures[index].split("\t", 2);
    const [returnedType, returnedHex] = returned[index].split("\t", 2);
    const schema = schemasByName.get(expectedType);
    if (returnedType !== expectedType || schema === undefined) {
      throw new Error(
        `${consumer.name} fixture ${index} returned unexpected type ${returnedType}`,
      );
    }
    const expected = fromBinary(schema, Buffer.from(expectedHex, "hex"));
    const actual = fromBinary(schema, Buffer.from(returnedHex, "hex"));
    if (!equals(schema, expected, actual)) {
      throw new Error(`${source} -> ${consumer.name} fixture ${index} changed normalized protobuf semantics`);
    }
  }
  return returned;
}

const outputs = consumers.map(consumer => exchange(consumer, "TypeScript", fixtures));
// The checks above decode both native outputs in TypeScript. Also feed each native
// encoder's output to the other native decoder, completing all six binary directions.
exchange(consumers[0], "Rust", outputs[1]);
exchange(consumers[1], "Python", outputs[0]);
console.log("Validated 11,000 fixtures (1,000 per domain message) across all six binary language directions.");
