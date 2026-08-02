/**
 * U01 acceptance scenarios: the same scenario matrix runs against the web and
 * desktop platform bindings, covering Research create/stream/cancel/evidence
 * navigation, noindex metadata, and small-screen high-risk action rules.
 */

import { describe, expect, it } from "vitest";
import { InMemoryTerminalBackend, createTerminalClient } from "@sumalpha/api-client";
import {
  PAGE_REGISTRY,
  advanceComposer,
  buildCommandCenterModel,
  buildEvidencePanel,
  buildSnapshotCatalog,
  catchUpStream,
  composerSubmission,
  confirmCancel,
  createComposerState,
  detailStateFromRun,
  mergeStreamEvents,
  pageMetaFor,
  requestCancel,
  resolveAuthState,
  visibleHighRiskActions,
  viewportForWidth,
} from "@sumalpha/domain-ui";
import type { PlatformKind } from "@sumalpha/platform";

import { createTerminalApp, type TerminalApp } from "../src/app.js";

function apps(): { kind: PlatformKind; app: TerminalApp }[] {
  return (["web", "desktop"] as const).map((kind) => ({
    kind,
    app: createTerminalApp(kind, createTerminalClient(new InMemoryTerminalBackend())),
  }));
}

describe("U01 shared scenarios (web + desktop)", () => {
  for (const { kind, app } of apps()) {
    it(`creates research, streams with dedup, cancels with confirmation, and resolves evidence routes on ${kind}`, async () => {
      // P03: three-step composer
      let composer = createComposerState();
      composer = { ...composer, question: "验证 BTC 动量延续假设" };
      composer = advanceComposer(composer);
      expect(composer.step).toBe("sources");
      composer = {
        ...composer,
        capability: "research.hypothesis.v1",
        dataSnapshotId: "snapshot-btc-2026-07-31",
      };
      composer = advanceComposer(composer);
      expect(composer.step).toBe("review");

      const run = await app.client.createResearchRun(composerSubmission(composer));
      expect(run.runId).toMatch(/^run-/);

      // P04: stream with duplicates merged by sequence
      let detail = detailStateFromRun(run);
      detail = await catchUpStream(app.client, detail);
      const duplicateFeed = await app.client.streamResearchEvents(run.runId, 0);
      detail = mergeStreamEvents(detail, duplicateFeed);
      expect(detail.events.map((event) => event.sequence)).toEqual([1, 2, 3]);
      expect(detail.status).toBe("succeeded");

      // reconnect catch-up only fetches events after last_sequence
      const after = await app.client.streamResearchEvents(run.runId, detail.lastSequence);
      expect(after).toHaveLength(0);

      // cancel: UI holds "cancelling" until server confirmation
      detail = { ...detail, status: "running" };
      detail = await requestCancel(app.client, detail);
      expect(detail.cancelUi).toBe("cancelling");
      detail = await requestCancel(app.client, detail); // idempotent UI request
      detail = await confirmCancel(app.client, detail);
      expect(detail.cancelUi).toBe("cancelled");
      expect(detail.status).toBe("cancelled");

      // evidence navigation: artifact and snapshot routes resolve
      const panel = buildEvidencePanel(detail, run.dataSnapshotId);
      expect(panel.entries).toHaveLength(2);
      expect(panel.entries[0]?.artifactRoute).toMatch(/^\/artifacts\//);
      expect(panel.snapshotRoute).toBe(`/data-snapshots/${run.dataSnapshotId}`);
    });

    it(`serves auth, command center, and snapshot catalog models on ${kind}`, async () => {
      const session = await app.client.session;
      const auth = resolveAuthState(session, { networkOnline: true });
      expect(auth.kind).toBe("signed_in");

      const offline = resolveAuthState(session, { networkOnline: false });
      expect(offline.kind).toBe("offline");

      const commandCenter = buildCommandCenterModel(await app.client.commandCenter);
      expect(commandCenter.kpis).toHaveLength(3);
      expect(commandCenter.emptyQueueCopy).toContain("没有需要你处理的事项");

      const catalog = buildSnapshotCatalog(await app.client.listDataSnapshots());
      expect(catalog).toHaveLength(2);
      const degraded = catalog.find((card) => card.qualityLabel === "degraded");
      expect(degraded?.canUseForTrading).toBe(false);
      expect(degraded?.qualityCopy).toContain("质量限制");
    });

    it(`hides high-risk actions on small screens and shows them on regular screens on ${kind}`, () => {
      const detailRoute = pageMetaFor("/research/:runId");
      expect(detailRoute.highRiskActions).toContain("cancel_run");

      const small = viewportForWidth(390);
      const regular = viewportForWidth(1440);
      expect(visibleHighRiskActions(detailRoute, small)).toEqual([]);
      expect(visibleHighRiskActions(detailRoute, regular)).toEqual([
        "cancel_run",
        "create_strategy_draft",
      ]);

      expect(app.actionsFor("/research/new", 390)).toEqual([]);
      expect(app.actionsFor("/research/new", 1440)).toEqual(["start_research"]);
    });
  }

  it("marks every terminal page as noindex", () => {
    expect(PAGE_REGISTRY.length).toBeGreaterThanOrEqual(12);
    for (const page of PAGE_REGISTRY) {
      expect(page.robots).toBe("noindex");
    }
  });

  it("keeps platform bindings divergent only at the adapter surface", () => {
    const [web, desktop] = apps();
    expect(web.app.platform.authFlow).toBe("browser_redirect");
    expect(desktop.app.platform.authFlow).toBe("system_browser_deep_link");
    expect(desktop.app.platform.localFileImport).toBe(true);
    expect(web.app.platform.localFileImport).toBe(false);
    expect(web.app.platform.deepLinkScheme).not.toContain("token");
    expect(desktop.app.platform.deepLinkScheme).not.toContain("token");
  });

  it("rejects trading instructions in the research composer", () => {
    let composer = createComposerState();
    composer = { ...composer, question: "帮我下单买入 BTC" };
    const advanced = advanceComposer(composer);
    expect(advanced.step).toBe("question");
  });
});
