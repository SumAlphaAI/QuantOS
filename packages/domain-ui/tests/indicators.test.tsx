import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConnectionStatusBar, DataFreshnessIndicator, RiskPostureBadge } from "../src/indicators";

describe("UI-103 domain indicators", () => {
  it("shows freshness with a machine-readable as-of time", () => { const html = renderToStaticMarkup(<DataFreshnessIndicator state="stale" asOf="2026-08-15T09:42:18+08:00" />); expect(html).toContain("dateTime=\"2026-08-15T09:42:18+08:00\""); expect(html).toContain("陈旧"); });
  it("fails closed for unknown risk posture", () => { const html = renderToStaticMarkup(<RiskPostureBadge posture="future_state" />); expect(html).toContain("data-blocking=\"true\""); expect(html).toContain("未知/需升级"); });
  it("announces offline status without relying on color", () => { const html = renderToStaticMarkup(<ConnectionStatusBar state="offline" />); expect(html).toContain("aria-live=\"polite\""); expect(html).toContain("当前离线"); expect(html).toContain("交易操作已暂停"); });
});

it("all risk states remain explicit in both locales", () => {
  for (const locale of ["en", "zh-CN"] as const) for (const posture of ["allow", "deny", "approval_required", "future_state"]) {
    const html = renderToStaticMarkup(<RiskPostureBadge posture={posture} locale={locale} reason="risk reason" />);
    expect(html).toContain(`data-blocking="${posture !== "allow"}"`);
    expect(html).toContain("risk reason");
  }
});
it("freshness and connection rendering includes all states and optional timestamps", () => {
  for (const locale of ["en", "zh-CN"] as const) {
    for (const state of ["live", "delayed", "stale", "unavailable"] as const) {
      expect(renderToStaticMarkup(<DataFreshnessIndicator state={state} locale={locale} />)).toContain("q-row");
    }
    for (const state of ["connected", "reconnecting", "offline"] as const) {
      const html = renderToStaticMarkup(<ConnectionStatusBar state={state} locale={locale} lastConnectedAt="2026-10-02T00:00:00Z" />);
      expect(html).toContain("2026-10-02T00:00:00Z");
      expect(html).toContain('role="status"');
    }
  }
});
