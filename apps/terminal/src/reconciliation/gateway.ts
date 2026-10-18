import {createBffClient, bffZodSchemas, parseBffResponse, SseStreamReducer, type BffComponents, type SseEventEnvelope} from "@sumalpha/api-client";
export const reconciliationClient = (origin: string, transport: typeof fetch = fetch) => createBffClient({baseUrl: origin, fetch: transport, timeoutMs: 10000});
/** A receipt never closes a break or modifies a ledger. Only server facts do. */
export function acceptedRerun(raw: unknown, status: number) {
  if (status !== 202) throw Error("Reconciliation was not accepted");
  return parseBffResponse("requestReconciliationRerun", status, raw) as BffComponents["schemas"]["AuditedAsyncAccepted"];
}
export class ReconciliationFacts {
  private readonly reducer = new SseStreamReducer();
  private streamId?: string;
  private value?: BffComponents["schemas"]["ReconciliationRun"];
  constructor(readonly accountId: string, readonly runId: string) { bffZodSchemas.UUID.parse(accountId); bffZodSchemas.UUID.parse(runId); }
  get snapshot() { return this.value && structuredClone(this.value); }
  get afterSequence() { return this.reducer.resumeAfter; }
  accepted(raw: unknown): void { bffZodSchemas.AuditedAsyncAccepted.parse(raw); }
  revoke(): void { this.reducer.close(); this.value = undefined; }
  apply(raw: SseEventEnvelope): "applied" | "ignored" | "revoked" {
    if (this.reducer.isClosed) throw Error("Reconciliation permission revoked");
    const event = bffZodSchemas.StreamEvent.parse(raw);
    if (event.payload.type === "permission_revoked") { this.revoke(); return "revoked"; }
    if (this.streamId && this.streamId !== event.streamId) throw Error("Reconciliation lease changed");
    const run = bffZodSchemas.ReconciliationRun.parse(event.payload);
    if (run.accountId !== this.accountId || run.runId !== this.runId || run.mode !== "shadow" || run.correlationId !== event.correlationId) throw Error("Reconciliation resource mismatch");
    const action = this.reducer.accept(raw);
    if (action.type === "gap") throw Error("Reconciliation stream gap");
    if (action.type !== "apply") return "ignored";
    this.value = structuredClone(run); this.streamId = event.streamId; return "applied";
  }
  url(base: string): string { const u = new URL(`/v1/reconciliation/runs/${encodeURIComponent(this.runId)}/stream`, base); u.searchParams.set("afterSequence", String(this.afterSequence)); return u.toString(); }
}
