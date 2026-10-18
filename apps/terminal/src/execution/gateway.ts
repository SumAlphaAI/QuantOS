import {createBffClient, parseBffResponse, bffZodSchemas, SseStreamReducer, type BffComponents, type SseEventEnvelope} from "@sumalpha/api-client";
/** Cookie authority is injected by the transport; browser constructs references only. */
export const executionClient = (origin: string, transport: typeof fetch = fetch) => createBffClient({baseUrl: origin, fetch: transport, timeoutMs: 10000});
export class OrderFacts {
  private readonly reducer = new SseStreamReducer();
  private streamId?: string;
  private value?: BffComponents["schemas"]["Order"];
  constructor(readonly accountId: string, readonly orderId: string, readonly authorityScope: string) {
    bffZodSchemas.UUID.parse(accountId); bffZodSchemas.UUID.parse(orderId);
    if (!authorityScope.trim()) throw Error("Authority scope required");
  }
  get snapshot() { return this.value && structuredClone(this.value); }
  get afterSequence() { return this.reducer.resumeAfter; }
  /** A 202 is a receipt. It cannot set Order/Fill state. */
  accepted(raw: unknown): void { bffZodSchemas.AsyncAccepted.parse(raw); }
  revoke(): void { this.reducer.close(); this.value = undefined; }
  apply(raw: SseEventEnvelope): "applied" | "ignored" | "revoked" {
    if (this.reducer.isClosed) throw Error("Order permission revoked");
    const event = bffZodSchemas.StreamEvent.parse(raw);
    if (event.payload.type === "permission_revoked") { this.revoke(); return "revoked"; }
    if (this.streamId && this.streamId !== event.streamId) throw Error("Order lease changed; refresh required");
    const order = bffZodSchemas.Order.parse(event.payload);
    if (order.orderId !== this.orderId || order.accountId !== this.accountId || order.mode !== "paper" || order.correlationId !== event.correlationId) throw Error("Order resource mismatch");
    const action = this.reducer.accept(raw);
    if (action.type === "gap") throw Error("Order stream gap; replay required");
    if (action.type !== "apply") return "ignored";
    this.value = structuredClone(order); this.streamId = event.streamId; return "applied";
  }
  url(base: string): string { const u = new URL(`/v1/orders/${encodeURIComponent(this.orderId)}/stream`, base); u.searchParams.set("afterSequence", String(this.afterSequence)); return u.toString(); }
}
export function approvedCommandRef(raw: unknown, now = Date.now()): string {
  const approval = bffZodSchemas.Approval.parse(raw);
  if (approval.status !== "approved" || approval.issuanceState !== "consumed" || !approval.commandRef || !approval.commandExpiresAt || Date.parse(approval.commandExpiresAt) <= now) throw Error("Fresh server command reference required");
  return approval.commandRef;
}
export function acceptedCommand(raw: unknown, status: number) {
  if (status !== 202) throw Error("Command was not accepted");
  return parseBffResponse("submitTradeCommand", status, raw) as BffComponents["schemas"]["AsyncAccepted"];
}
