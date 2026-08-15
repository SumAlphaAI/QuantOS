import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildDataGridSearchParams, createThemeVariables, DataGrid, EvidenceTimeline, isDangerConfirmationValid, translate } from "../src/index";
import { evidenceEvents, orderColumns, orders } from "../src/fixtures/ui103";

describe("UI-103 foundation", () => {
  it("maps both themes to frozen semantic tokens", () => {
    expect(createThemeVariables("dark")["--q-surface-0"]).toBe("#0E1420");
    expect(createThemeVariables("light")["--q-text-primary"]).toBe("#16202E");
  });
  it("translates safety copy in both locales", () => {
    expect(translate("zh-CN", "safety.offline")).toContain("连接已断开");
    expect(translate("en", "safety.offline")).toContain("Connection lost");
  });
  it("requires an exact phrase and a six-digit MFA when configured", () => {
    expect(isDangerConfirmationValid("CANCEL", "CANCEL", false, "")).toBe(true);
    expect(isDangerConfirmationValid("cancel", "CANCEL", false, "")).toBe(false);
    expect(isDangerConfirmationValid("CANCEL", "CANCEL", true, "12345")).toBe(false);
    expect(isDangerConfirmationValid("CANCEL", "CANCEL", true, "123456")).toBe(true);
  });
  it("serializes server grid state for URL synchronization", () => {
    const params = buildDataGridSearchParams({ page: 3, sort: { columnId: "updatedAt", direction: "desc" }, filters: [{ id: "symbol", label: "标的", value: "BTC-USDT" }], visibleColumnIds: ["id", "symbol"] });
    expect(params.get("grid.page")).toBe("3"); expect(params.get("grid.filter.symbol")).toBe("BTC-USDT"); expect(params.get("grid.columns")).toBe("id,symbol");
  });
});

describe("UI-103 data surfaces", () => {
  it("renders an accessible server-sorted grid with correlation evidence on error", () => {
    const markup = renderToStaticMarkup(<DataGrid title="订单队列" columns={orderColumns} rows={orders} rowKey={(row) => row.id} sort={{ columnId: "updatedAt", direction: "desc" }} />);
    expect(markup).toContain("aria-sort=\"descending\""); expect(markup).toContain("ord-1042");
    const error = renderToStaticMarkup(<DataGrid title="订单队列" columns={orderColumns} rows={[]} rowKey={(row) => row.id} state="error" correlationId="cor-ui103" />);
    expect(error).toContain("role=\"alert\""); expect(error).toContain("cor-ui103");
  });
  it("renders semantic ordered timeline and expandable evidence", () => {
    const markup = renderToStaticMarkup(<EvidenceTimeline title="证据链" events={evidenceEvents} />);
    expect(markup).toContain("<ol"); expect(markup).toContain("<details"); expect(markup).toContain("cor-7f83a1");
  });
});
