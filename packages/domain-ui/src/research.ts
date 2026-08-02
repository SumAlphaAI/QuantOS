/**
 * P03/P04 Research page view models: the three-step composer, the streaming
 * run detail (sequence-dedup, reconnect catch-up, cancel-confirm), and the
 * evidence panel navigation. Rendering layers bind these models 1:1.
 */

import type {
  CreateResearchRunInput,
  ResearchEvidence,
  ResearchRunDetail,
  ResearchRunStatus,
  ResearchStreamEvent,
  TerminalClient,
} from "@sumalpha/api-client";

// ---------------------------------------------------------------------------
// P03 Research composer (three steps: question -> snapshot/engine -> review)
// ---------------------------------------------------------------------------

export type ComposerStep = "question" | "sources" | "review";

export interface ResearchComposerState {
  step: ComposerStep;
  question: string;
  title: string;
  capability: string | null;
  dataSnapshotId: string | null;
  budgetUnits: number;
  deadlineAt: string;
}

export function createComposerState(): ResearchComposerState {
  return {
    step: "question",
    question: "",
    title: "",
    capability: null,
    dataSnapshotId: null,
    budgetUnits: 250,
    deadlineAt: "2026-08-01T01:00:00Z",
  };
}

export type ComposerValidation =
  | { ok: true }
  | { ok: false; reason: string };

export function validateComposer(state: ResearchComposerState): ComposerValidation {
  if (state.step === "question") {
    if (state.question.trim().length < 8) {
      return { ok: false, reason: "研究问题至少需要 8 个字符。" };
    }
    if (/下单|place order|trade command/i.test(state.question)) {
      return { ok: false, reason: "不要在此输入交易指令。" };
    }
    return { ok: true };
  }
  if (state.step === "sources") {
    if (!state.capability) {
      return { ok: false, reason: "请选择批准的 Engine capability。" };
    }
    if (!state.dataSnapshotId) {
      return { ok: false, reason: "请选择数据快照。" };
    }
    return { ok: true };
  }
  return { ok: true };
}

export function advanceComposer(state: ResearchComposerState): ResearchComposerState {
  const validation = validateComposer(state);
  if (!validation.ok) {
    return state;
  }
  const order: ComposerStep[] = ["question", "sources", "review"];
  const index = order.indexOf(state.step);
  return { ...state, step: order[Math.min(index + 1, order.length - 1)] };
}

export function composerSubmission(state: ResearchComposerState): CreateResearchRunInput {
  if (!state.capability || !state.dataSnapshotId) {
    throw new Error("composer is missing capability or snapshot");
  }
  return {
    title: state.title || state.question.slice(0, 24),
    question: state.question,
    capability: state.capability,
    dataSnapshotId: state.dataSnapshotId,
    budgetUnits: state.budgetUnits,
    deadlineAt: state.deadlineAt,
  };
}

// ---------------------------------------------------------------------------
// P04 Research detail: stream dedup, reconnect catch-up, cancel confirmation
// ---------------------------------------------------------------------------

export type CancelUiState = "idle" | "cancelling" | "cancelled";

export interface ResearchDetailState {
  runId: string;
  status: ResearchRunStatus;
  events: ResearchStreamEvent[];
  lastSequence: number;
  cancelUi: CancelUiState;
  evidence: ResearchEvidence[];
  inputHash: string;
  correlationId: string;
}

export function detailStateFromRun(run: ResearchRunDetail): ResearchDetailState {
  return {
    runId: run.runId,
    status: run.status,
    events: [],
    lastSequence: 0,
    cancelUi: "idle",
    evidence: [...run.evidence],
    inputHash: run.inputHash,
    correlationId: run.correlationId,
  };
}

/** Merge streamed events with sequence dedup and ordering. */
export function mergeStreamEvents(
  state: ResearchDetailState,
  incoming: ResearchStreamEvent[],
): ResearchDetailState {
  const seen = new Set(state.events.map((event) => event.sequence));
  const merged = [...state.events];
  for (const event of incoming) {
    if (seen.has(event.sequence)) {
      continue;
    }
    seen.add(event.sequence);
    merged.push(event);
  }
  merged.sort((left, right) => left.sequence - right.sequence);
  const lastSequence = merged.at(-1)?.sequence ?? state.lastSequence;
  const doneEvent = merged.find((event) => event.done);
  const status: ResearchRunStatus =
    state.cancelUi !== "idle"
      ? state.status
      : doneEvent?.phase === "cancelled"
        ? "cancelled"
        : doneEvent
          ? "succeeded"
          : state.status;
  return { ...state, events: merged, lastSequence, status };
}

/** Catch up after a reconnect using `last_event_id` semantics. */
export async function catchUpStream(
  client: TerminalClient,
  state: ResearchDetailState,
): Promise<ResearchDetailState> {
  const incoming = await client.streamResearchEvents(state.runId, state.lastSequence);
  return mergeStreamEvents(state, incoming);
}

/** Request cancellation; UI stays in "cancelling" until the server confirms. */
export async function requestCancel(
  client: TerminalClient,
  state: ResearchDetailState,
): Promise<ResearchDetailState> {
  if (state.cancelUi !== "idle") {
    return state;
  }
  const status = await client.cancelResearchRun(state.runId);
  return {
    ...state,
    status,
    cancelUi: status === "cancelled" ? "cancelled" : "cancelling",
  };
}

/** Confirm cancellation once the server acknowledges the terminal state. */
export async function confirmCancel(
  client: TerminalClient,
  state: ResearchDetailState,
): Promise<ResearchDetailState> {
  if (state.cancelUi !== "cancelling") {
    return state;
  }
  const run = await client.getResearchRun(state.runId);
  if (run.status === "cancelled") {
    return { ...state, status: "cancelled", cancelUi: "cancelled" };
  }
  return { ...state, status: run.status };
}

// ---------------------------------------------------------------------------
// Evidence panel navigation (P04 -> artifact/snapshot routes)
// ---------------------------------------------------------------------------

export interface EvidencePanelModel {
  inputHash: string;
  correlationId: string;
  entries: {
    evidenceId: string;
    summary: string;
    artifactRoute: string;
  }[];
  snapshotRoute: string;
}

export function buildEvidencePanel(
  state: ResearchDetailState,
  dataSnapshotId: string,
): EvidencePanelModel {
  return {
    inputHash: state.inputHash,
    correlationId: state.correlationId,
    entries: state.evidence.map((entry) => ({
      evidenceId: entry.evidenceId,
      summary: entry.summary,
      artifactRoute: `/artifacts/${entry.artifactId}`,
    })),
    snapshotRoute: `/data-snapshots/${dataSnapshotId}`,
  };
}
