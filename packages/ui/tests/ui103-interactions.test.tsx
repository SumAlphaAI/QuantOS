// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DataGrid, DangerConfirmDialog, EvidenceTimeline, I18nProvider, ThemeProvider, isDangerConfirmationValid, type DataGridColumn } from "../src/index";

afterEach(cleanup);
const columns: DataGridColumn<number>[] = [
  {id:"id", header:"ID", cell: String, sortable:true, pinned:"left",width:100},
  {id:"value", header:"Value", cell: n=>`Value ${n}`, pinned:"right",width:120},
  {id:"audit", header:"Audit", cell: n=>`Audit ${n}`, pinned:"right",width:180},
];
const rows=Array.from({length:1000},(_,i)=>i);
it("recovers the virtual window when the server replaces a long dataset", () => {
  const {rerender}=render(<DataGrid title="Orders" columns={columns} rows={rows} rowKey={String} virtualize viewportRows={10}/>);
  const scroll=screen.getByRole("region",{name:"Orders 表格滚动区域"});
  fireEvent.scroll(scroll,{target:{scrollTop:30000}});
  expect(screen.queryByRole("cell",{name:"Value 0"})).toBeNull();
  rerender(<DataGrid title="Orders" columns={columns} rows={[1,2]} rowKey={String} virtualize viewportRows={10}/>);
  expect(screen.getByRole("cell",{name:"Value 1"})).toBeTruthy(); expect(scroll.scrollTop).toBe(0);
  expect(screen.getByRole("table").getAttribute("aria-rowcount")).toBe("3");
});
it("keeps distinct heading IDs, ordered pin offsets, controlled server actions and foreign URL parameters", () => {
  window.history.replaceState({},"","/?keep=1&orders.filter.old=stale#anchor");
  const sort=vi.fn(),page=vi.fn(),filter=vi.fn(),visible=vi.fn();
  render(<I18nProvider locale="en"><DataGrid title="Orders" columns={columns} rows={[1]} rowKey={String} page={2} pageCount={3} sort={{columnId:"id",direction:"asc"}} filters={[{id:"query",label:"Search",value:"old"}]} visibleColumnIds={["id","value","audit"]} onSortChange={sort} onPageChange={page} onFilterChange={filter} onVisibleColumnIdsChange={visible} urlSync={{enabled:true,namespace:"orders"}}/><EvidenceTimeline title="Orders" events={[]}/></I18nProvider>);
  const headings=screen.getAllByRole("heading");expect(headings[0].id).not.toBe(headings[1].id);
  expect(screen.getByRole("columnheader",{name:"Value"}).style.right).toBe("180px");
  expect(screen.getByRole("columnheader",{name:"Audit"}).style.right).toBe("0px");
  fireEvent.click(screen.getByRole("button",{name:"ID"}));expect(sort).toHaveBeenCalledWith("id","desc");
  fireEvent.click(screen.getByRole("button",{name:"Next page"}));expect(page).toHaveBeenCalledWith(3);
  fireEvent.change(screen.getByRole("searchbox"),{target:{value:"new"}});expect(filter).toHaveBeenCalledWith("query","new");
  fireEvent.click(screen.getByRole("checkbox",{name:"Audit"}));expect(visible).toHaveBeenCalledWith(["id","value"]);
  expect(window.location.search).toContain("keep=1");expect(window.location.search).not.toContain("filter.old");expect(window.location.hash).toBe("#anchor");
});
it("rejects empty and whitespace-only confirmation configurations without weakening exactness or MFA", () => {
  expect(isDangerConfirmationValid("","",false,"")).toBe(false);
  expect(isDangerConfirmationValid("   ","   ",false,"")).toBe(false);
  expect(isDangerConfirmationValid(" CANCEL","CANCEL",false,"")).toBe(false);
  expect(isDangerConfirmationValid("CANCEL","CANCEL",true,"12a456")).toBe(false);
});
it("latches submissions, keeps the pending dialog open and redacts callback failures before retry", async () => {
  let reject!: (reason:Error)=>void; const confirm=vi.fn(()=>new Promise<void>((_,r)=>{reject=r;}));
  render(<ThemeProvider><I18nProvider locale="en"><DangerConfirmDialog trigger={<button>Open</button>} title="Cancel order" summary="Order 1" impact="Irreversible" confirmPhrase="CANCEL" confirmLabel="Confirm" mfaRequired onConfirm={confirm}/></I18nProvider></ThemeProvider>);
  fireEvent.click(screen.getByRole("button",{name:"Open"}));
  expect(document.activeElement).toBe(screen.getByRole("button",{name:"Cancel"}));
  fireEvent.change(screen.getByLabelText("Type “CANCEL” to confirm"),{target:{value:"CANCEL"}});
  fireEvent.change(screen.getByLabelText("MFA code"),{target:{value:"123456"}});
  await act(async()=>{ const button=screen.getByRole("button",{name:"Confirm"});button.click();button.click(); });
  expect(confirm).toHaveBeenCalledTimes(1); expect(confirm).toHaveBeenCalledWith({phrase:"CANCEL",mfaCode:"123456"});
  fireEvent.keyDown(screen.getByRole("dialog"),{key:"Escape"});expect(screen.getByRole("dialog")).toBeTruthy();
  await act(async()=>{reject(new Error("secret-token=private"));});
  expect(screen.queryByText(/secret-token/)).toBeNull();expect(screen.getAllByRole("alert").some(alert=>alert.textContent?.includes("Retry"))).toBe(true);
  expect((screen.getByLabelText("MFA code") as HTMLInputElement).value).toBe("");
  expect((screen.getByRole("button",{name:"Confirm"}) as HTMLButtonElement).disabled).toBe(true);
  confirm.mockResolvedValueOnce(undefined);
  fireEvent.change(screen.getByLabelText("MFA code"),{target:{value:"654321"}});
  await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Confirm"}));});
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("dialog")).toBeNull();await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole("button",{name:"Open"})));

});
it("localizes every non-default grid and timeline state without exposing supplied rows", () => {
  for(const state of ["loading","empty","error","unauthorized","stale","offline"] as const){
    const {unmount}=render(<I18nProvider locale="en"><DataGrid title="Table" columns={columns} rows={[9]} rowKey={String} state={state}/><EvidenceTimeline title="Evidence" events={[]} state={state}/></I18nProvider>);
    expect(screen.queryByRole("table")).toBeNull();expect(screen.queryByText("Value 9")).toBeNull();
    expect(screen.getAllByRole(state==="error"?"alert":"status")).toHaveLength(2);unmount();
  }
});
