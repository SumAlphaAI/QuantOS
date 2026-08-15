"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode, type UIEvent } from "react";
import { Button } from "../Button/Button";
import designTokens from "../../tokens/index";

export type ComponentState = "default" | "loading" | "empty" | "error" | "unauthorized" | "stale" | "offline";
export type SortDirection = "asc" | "desc";
export interface DataGridColumn<Row> { id: string; header: string; cell: (row: Row) => ReactNode; sortable?: boolean; numeric?: boolean; pinned?: "left" | "right"; width?: number }
export interface DataGridFilter { id: string; label: string; value: string; placeholder?: string }
export interface DataGridUrlSync { enabled: boolean; namespace?: string; mode?: "replace" | "push" }
export interface DataGridProps<Row> {
  title: string; columns: DataGridColumn<Row>[]; rows: Row[]; rowKey: (row: Row) => string; state?: ComponentState;
  stateMessage?: string; correlationId?: string; page?: number; pageCount?: number; sort?: { columnId: string; direction: SortDirection };
  filters?: DataGridFilter[]; onFilterChange?: (filterId: string, value: string) => void; visibleColumnIds?: string[]; onVisibleColumnIdsChange?: (columnIds: string[]) => void;
  virtualize?: boolean; viewportRows?: number; urlSync?: DataGridUrlSync;
  onSortChange?: (columnId: string, direction: SortDirection) => void; onPageChange?: (page: number) => void; toolbar?: ReactNode;
}
const stateTitles: Record<Exclude<ComponentState, "default">, string> = { loading: "正在加载", empty: "暂无数据", error: "加载失败", unauthorized: "无权访问", stale: "数据已陈旧", offline: "当前离线" };
function GridState({ state, message, correlationId }: { state: Exclude<ComponentState, "default">; message?: string; correlationId?: string }) {
  return <div className="q-state" role={state === "error" ? "alert" : "status"} aria-live="polite"><div className="q-state__content"><p className="q-state__title">{stateTitles[state]}</p>{message ? <p className="q-state__message">{message}</p> : null}{correlationId ? <p className="q-state__message q-mono">Correlation ID: {correlationId}</p> : null}</div></div>;
}
export function buildDataGridSearchParams(input: Pick<DataGridProps<unknown>, "page" | "sort" | "filters" | "visibleColumnIds">, namespace = "grid"): URLSearchParams {
  const params = new URLSearchParams(); const prefix = `${namespace}.`;
  if (input.page && input.page > 1) params.set(`${prefix}page`, String(input.page));
  if (input.sort) { params.set(`${prefix}sort`, input.sort.columnId); params.set(`${prefix}direction`, input.sort.direction); }
  for (const filter of input.filters ?? []) if (filter.value) params.set(`${prefix}filter.${filter.id}`, filter.value);
  if (input.visibleColumnIds?.length) params.set(`${prefix}columns`, input.visibleColumnIds.join(","));
  return params;
}
export function DataGrid<Row>({ title, columns, rows, rowKey, state = "default", stateMessage, correlationId, page = 1, pageCount = 1, sort, filters = [], onFilterChange, visibleColumnIds, onVisibleColumnIdsChange, virtualize = false, viewportRows = 10, urlSync, onSortChange, onPageChange, toolbar }: DataGridProps<Row>) {
  const effectiveState = state === "default" && rows.length === 0 ? "empty" : state;
  const [scrollTop, setScrollTop] = useState(0); const rowHeight = designTokens.density.compact.rowHeight; const overscan = 3;
  const visibleColumns = useMemo(() => visibleColumnIds ? columns.filter((column) => visibleColumnIds.includes(column.id)) : columns, [columns, visibleColumnIds]);
  const startIndex = virtualize ? Math.max(0, Math.floor(scrollTop / rowHeight) - overscan) : 0; const endIndex = virtualize ? Math.min(rows.length, startIndex + viewportRows + overscan * 2) : rows.length;
  const visibleRows = virtualize ? rows.slice(startIndex, endIndex) : rows;
  const pinnedLeft = new Map<string, number>(); let left = 0; for (const column of visibleColumns) if (column.pinned === "left") { pinnedLeft.set(column.id, left); left += column.width ?? 160; }
  useEffect(() => {
    if (!urlSync?.enabled || typeof window === "undefined") return;
    const managed = buildDataGridSearchParams({ page, sort, filters, visibleColumnIds } as DataGridProps<unknown>, urlSync.namespace); const next = new URL(window.location.href); const prefix = `${urlSync.namespace ?? "grid"}.`;
    for (const key of [...next.searchParams.keys()]) if (key.startsWith(prefix)) next.searchParams.delete(key);
    managed.forEach((value, key) => next.searchParams.set(key, value)); window.history[urlSync.mode === "push" ? "pushState" : "replaceState"]({}, "", next);
  }, [filters, page, sort, urlSync, visibleColumnIds]);
  function pinnedStyle(column: DataGridColumn<Row>): CSSProperties | undefined { if (!column.pinned) return column.width ? { width: column.width, minWidth: column.width } : undefined; return { position: "sticky", [column.pinned]: column.pinned === "left" ? pinnedLeft.get(column.id) : 0, width: column.width, minWidth: column.width ?? 160, zIndex: 2, background: "var(--q-surface-1)" }; }
  function onScroll(event: UIEvent<HTMLDivElement>) { if (virtualize) setScrollTop(event.currentTarget.scrollTop); }
  function toggleColumn(columnId: string, checked: boolean) { const current = visibleColumnIds ?? columns.map((column) => column.id); onVisibleColumnIdsChange?.(checked ? [...current, columnId] : current.filter((id) => id !== columnId)); }
  return <section className="q-panel" aria-labelledby={`${title.replace(/\s+/g, "-").toLowerCase()}-title`} aria-busy={state === "loading" || undefined}>
    <header className="q-panel__header"><h2 className="q-panel__title" id={`${title.replace(/\s+/g, "-").toLowerCase()}-title`}>{title}</h2><div className="q-row">{toolbar}{onVisibleColumnIdsChange ? <details className="q-column-menu"><summary>显示列</summary><div className="q-column-menu__body">{columns.map((column) => { const checked = visibleColumnIds?.includes(column.id) ?? true; return <label key={column.id}><input type="checkbox" checked={checked} disabled={checked && visibleColumns.length === 1} onChange={(event) => toggleColumn(column.id, event.target.checked)} /> {column.header}</label>; })}</div></details> : null}</div></header>
    {filters.length ? <div className="q-filters" aria-label={`${title} 过滤条件`}>{filters.map((filter) => <label className="q-field q-field--inline" key={filter.id}>{filter.label}<input className="q-input" type="search" value={filter.value} placeholder={filter.placeholder} onChange={(event) => onFilterChange?.(filter.id, event.target.value)} /></label>)}</div> : null}
    {effectiveState !== "default" ? <GridState state={effectiveState} message={stateMessage} correlationId={correlationId} /> : <>
      <div className={`q-table-wrap${virtualize ? " q-table-wrap--virtual" : ""}`} style={virtualize ? { maxHeight: rowHeight * viewportRows } : undefined} onScroll={onScroll}><table className="q-table"><thead><tr>{visibleColumns.map((column) => <th key={column.id} scope="col" style={pinnedStyle(column)} aria-sort={sort?.columnId === column.id ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>{column.sortable ? <button className="q-sort" type="button" onClick={() => onSortChange?.(column.id, sort?.columnId === column.id && sort.direction === "asc" ? "desc" : "asc")}>{column.header}{sort?.columnId === column.id ? <span aria-hidden="true"> {sort.direction === "asc" ? "↑" : "↓"}</span> : null}</button> : column.header}</th>)}</tr></thead>
        <tbody>{virtualize && startIndex > 0 ? <tr aria-hidden="true"><td colSpan={visibleColumns.length} style={{ height: startIndex * rowHeight, padding: 0, border: 0 }} /></tr> : null}{visibleRows.map((row) => <tr key={rowKey(row)}>{visibleColumns.map((column) => <td key={column.id} style={pinnedStyle(column)} className={column.numeric ? "q-mono" : undefined}>{column.cell(row)}</td>)}</tr>)}{virtualize && endIndex < rows.length ? <tr aria-hidden="true"><td colSpan={visibleColumns.length} style={{ height: (rows.length - endIndex) * rowHeight, padding: 0, border: 0 }} /></tr> : null}</tbody></table></div>
      {pageCount > 1 ? <nav className="q-pagination" aria-label={`${title} 分页`}><Button disabled={page <= 1} onClick={() => onPageChange?.(page - 1)}>上一页</Button><span aria-live="polite">第 {page} / {pageCount} 页</span><Button disabled={page >= pageCount} onClick={() => onPageChange?.(page + 1)}>下一页</Button></nav> : null}
    </>}
  </section>;
}
