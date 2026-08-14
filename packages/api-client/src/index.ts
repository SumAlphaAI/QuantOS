export function createApiClientName(): string {
  return "api-client";
}

export * from "./terminal.js";
export * from "./strategy.js";
export * from "./execution.js";
export * from "./ops.js";
export * from "./sse.js";
export * from "./bff.js";
export type { components as BffComponents, operations as BffOperations, paths as BffPaths } from "./bff-gen/quantos-bff.js";
export * from "./gen/quantos/common/v1/common_pb.js";
export * from "./gen/quantos/research/v1/research_pb.js";
export * from "./gen/quantos/strategy/v1/strategy_pb.js";
export * from "./gen/quantos/trading/v1/trading_pb.js";
export * from "./gen/quantos/engine/v1/engine_pb.js";
export * from "./gen/quantos/events/v1/events_pb.js";
