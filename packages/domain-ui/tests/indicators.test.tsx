import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConnectionStatusBar, DataFreshnessIndicator, RiskPostureBadge } from "../src/indicators";

describe("UI-103 domain indicators", () => {
  it("shows freshness with a machine-readable as-of time", () => { const html = renderToStaticMarkup(<DataFreshnessIndicator state="stale" asOf="2026-08-15T09:42:18+08:00" />); expect(html).toContain("dateTime=\"2026-08-15T09:42:18+08:00\""); expect(html).toContain("陈旧"); });
  it("fails closed for unknown risk posture", () => { const html = renderToStaticMarkup(<RiskPostureBadge posture="future_state" />); expect(html).toContain("data-blocking=\"true\""); expect(html).toContain("未知/需升级"); });
  it("announces offline status without relying on color", () => { const html = renderToStaticMarkup(<ConnectionStatusBar state="offline" />); expect(html).toContain("aria-live=\"polite\""); expect(html).toContain("当前离线"); expect(html).toContain("交易操作已暂停"); });
});
