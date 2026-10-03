/** Critical SSE state policy: validate before applying or acknowledging data. */
import { StreamEventSchema } from "./bff-gen/quantos-bff.zod.js";

export class SseContractError extends Error {}

export interface SseEventEnvelope {
  streamId: string;
  sequence: number;
  eventId: string;
  occurredAt: string;
  correlationId: string;
  payloadVersion: string;
  payload: { type?: string; [k: string]: unknown };
}

export type ReducerAction =
  | { type: "apply"; event: SseEventEnvelope }
  | { type: "duplicate"; event: SseEventEnvelope }
  | { type: "gap"; expected: number; got: number }
  | { type: "closed"; reason: "permission_revoked" };

export class SseStreamReducer {
  private lastSequence: number;
  private readonly seenEventIds = new Set<string>();
  private closed = false;

  /** @param startAfter 重连起点：只应用 sequence 严格大于 startAfter 的事件 */
  constructor(startAfter = 0) {
    this.lastSequence = startAfter;
  }

  get resumeAfter(): number {
    return this.lastSequence;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  accept(event: SseEventEnvelope): ReducerAction {
    if (!StreamEventSchema.safeParse(event).success) {
      throw new SseContractError("Unsupported or invalid SSE event; state was not applied");
    }
    if (this.closed || this.seenEventIds.has(event.eventId)) return { type: "duplicate", event };
    if (event.payload?.type === "permission_revoked") {
      this.seenEventIds.add(event.eventId);
      this.closed = true;
      return { type: "closed", reason: "permission_revoked" };
    }
    if (event.sequence <= this.lastSequence) return { type: "duplicate", event }; // 乱序迟到/重放
    if (event.sequence > this.lastSequence + 1) {
      return { type: "gap", expected: this.lastSequence + 1, got: event.sequence };
    }
    this.seenEventIds.add(event.eventId);
    this.lastSequence = event.sequence;
    return { type: "apply", event };
  }
}
