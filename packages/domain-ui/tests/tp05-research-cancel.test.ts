import { readFileSync } from "node:fs";

import type { ResearchStreamEvent, TerminalClient } from "@sumalpha/api-client";
import { expect, it, vi } from "vitest";

import { confirmCancel, mergeStreamEvents, requestCancel } from "../src/research.js";
import type { ResearchDetailState } from "../src/research.js";

function state(runId = "tp05-run"): ResearchDetailState {
  return { runId, status: "running", events: [], lastSequence: 0, cancelUi: "idle", evidence: [], inputHash: "sha256:fixture", correlationId: "tp05-correlation" };
}

it("keeps confirmed cancellation terminal when a completion arrives late", () => {
  const cancelled: ResearchDetailState = { ...state(), status: "cancelled", cancelUi: "cancelled" };
  const after = mergeStreamEvents(cancelled, [{ sequence: 2, runId: cancelled.runId, done: true, phase: "completed", payload: {} }]);
  expect(after.status).toBe("cancelled");
  expect(after.cancelUi).toBe("cancelled");
  expect(after.evidence).toEqual([]);
});

it("requests cancellation once and waits for server confirmation without creating a run", async () => {
  const cancel = vi.fn().mockResolvedValue("cancel_requested");
  const create = vi.fn();
  const read = vi.fn().mockResolvedValue({ status: "cancelled" });
  const client = { cancelResearchRun: cancel, getResearchRun: read, createResearchRun: create } as unknown as TerminalClient;
  const pending = await requestCancel(client, state());
  expect(pending.cancelUi).toBe("cancelling");
  expect(await requestCancel(client, pending)).toBe(pending);
  expect(cancel).toHaveBeenCalledTimes(1);
  const confirmed = await confirmCancel(client, pending);
  expect(confirmed.status).toBe("cancelled");
  expect(confirmed.cancelUi).toBe("cancelled");
  expect(create).not.toHaveBeenCalled();
});

// Explicit component integration supplies an actual local UDS transcript. Web-only CI
// runs the UI unit checks without requiring Python, and does not claim this integration.
it.skipIf(!process.env.QUANTOS_TP05_UI_PROBE)("TP05_UI_CANCEL_PASS actual Engine response bridge leaves no Artifact or UI mutation", async () => {
  const path = process.env.QUANTOS_TP05_UI_PROBE;
  expect(path).toBeTruthy();
  const transcript = JSON.parse(readFileSync(path!, "utf8")) as { status: string; runId: string; cancelStatus: string; artifactDelta: number; elapsedMs: number; grpcStatus: string; firstEvent: ResearchStreamEvent };
  expect(transcript.status).toBe("PASS");
  expect(transcript.grpcStatus).toBe("CANCELLED");
  expect(transcript.elapsedMs).toBeLessThan(2000);
  expect(transcript.artifactDelta).toBe(0);
  const cancel = vi.fn().mockResolvedValue(transcript.cancelStatus);
  const create = vi.fn();
  const client = { cancelResearchRun: cancel, createResearchRun: create } as unknown as TerminalClient;
  const running = mergeStreamEvents(state(transcript.runId), [transcript.firstEvent]);
  const cancelled = await requestCancel(client, running);
  expect(cancelled.status).toBe("cancelled");
  expect(cancelled.cancelUi).toBe("cancelled");
  expect(cancelled.evidence).toEqual([]);
  expect(await requestCancel(client, cancelled)).toBe(cancelled);
  expect(cancel).toHaveBeenCalledOnce();
  expect(create).not.toHaveBeenCalled();
});
