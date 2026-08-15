import { StateBadge, type DataGridColumn, type EvidenceEvent } from "../index";
export interface OrderFixture { id: string; symbol: string; side: "BUY" | "SELL"; quantity: number; state: string; updatedAt: string }
export const orders: OrderFixture[] = [
  { id: "ord-1042", symbol: "BTC-USDT", side: "BUY", quantity: 0.25, state: "awaiting_approval", updatedAt: "2026-08-15T09:42:18+08:00" },
  { id: "ord-1041", symbol: "ETH-USDT", side: "SELL", quantity: 4, state: "filled", updatedAt: "2026-08-15T09:38:02+08:00" },
  { id: "ord-1040", symbol: "SOL-USDT", side: "BUY", quantity: 30, state: "rejected", updatedAt: "2026-08-15T09:30:11+08:00" },
];
export const orderColumns: DataGridColumn<OrderFixture>[] = [
  { id: "id", header: "订单 ID", pinned: "left", width: 112, cell: (row) => <span className="q-mono">{row.id}</span> }, { id: "symbol", header: "标的", sortable: true, cell: (row) => row.symbol },
  { id: "side", header: "方向", cell: (row) => row.side }, { id: "quantity", header: "数量", numeric: true, sortable: true, cell: (row) => row.quantity.toFixed(2) },
  { id: "state", header: "状态", cell: (row) => <StateBadge state={row.state} label={row.state} /> }, { id: "updatedAt", header: "更新时间", sortable: true, cell: (row) => <time dateTime={row.updatedAt}>{row.updatedAt}</time> },
];
export const manyOrders: OrderFixture[] = Array.from({ length: 1_000 }, (_, index) => ({ id: `ord-${String(2_000 - index).padStart(4, "0")}`, symbol: index % 2 ? "ETH-USDT" : "BTC-USDT", side: index % 3 ? "BUY" : "SELL", quantity: index + 0.25, state: index % 5 ? "filled" : "awaiting_approval", updatedAt: `2026-08-15T09:${String(index % 60).padStart(2, "0")}:00+08:00` }));
export const evidenceEvents: EvidenceEvent[] = [
  { id: "evt-3", timestamp: "2026-08-15T09:42:18+08:00", actor: "risk-engine", event: "风险评估需要审批", state: "approval_required", correlationId: "cor-7f83a1", details: <pre>{JSON.stringify({ rule: "exposure.limit", actual: 0.83, threshold: 0.8 }, null, 2)}</pre> },
  { id: "evt-2", timestamp: "2026-08-15T09:42:17+08:00", actor: "strategy-orchestrator", event: "生成交易建议", state: "succeeded", correlationId: "cor-7f83a1" },
  { id: "evt-1", timestamp: "2026-08-15T09:42:14+08:00", actor: "market-data", event: "锁定估值快照", state: "succeeded", correlationId: "cor-7f83a1" },
];
