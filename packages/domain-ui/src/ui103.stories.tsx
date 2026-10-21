import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button, DataGrid, DangerConfirmDialog, EvidenceTimeline, I18nProvider, ThemeProvider, useI18n, useTheme, type DataGridColumn, type SortDirection } from "@sumalpha/ui";
import { ConnectionStatusBar, DataFreshnessIndicator, RiskPostureBadge } from "./indicators";
const rows=Array.from({length:1000},(_,id)=>({id:`row-${id}`,amount:id}));
const columns:DataGridColumn<(typeof rows)[number]>[]=[
  {id:"id",header:"ID",pinned:"left",width:120,cell:r=>r.id,sortable:true},
  {id:"amount",header:"Amount",numeric:true,width:220,cell:r=>r.amount,sortable:true},
  {id:"risk",header:"Risk",pinned:"right",width:160,cell:()=>"approval_required"},
  {id:"audit",header:"Audit",pinned:"right",width:100,cell:()=>"recorded"},
];
function Surface(){
  const {theme,setTheme}=useTheme(),{locale,setLocale}=useI18n();
  const [short,setShort]=useState(false),[page,setPage]=useState(1),[filter,setFilter]=useState(""),[visible,setVisible]=useState(columns.map(c=>c.id));
  const [sort,setSort]=useState<{columnId:string;direction:SortDirection}>({columnId:"id",direction:"asc"});
  const [outcome,setOutcome]=useState("success"),[count,setCount]=useState(0);
  return <main className="q-stack" data-testid="ui103-integration">
    <h1>UI-103 component integration</h1>
    <div className="q-row"><Button onClick={()=>setTheme(theme==="dark"?"light":"dark")}>Switch theme</Button><Button onClick={()=>setLocale(locale==="en"?"zh-CN":"en")}>Switch language</Button><Button onClick={()=>setShort(!short)}>{short?"Restore dataset":"Short dataset"}</Button></div>
    <ConnectionStatusBar state="offline"/><div className="q-row"><DataFreshnessIndicator state="stale"/><RiskPostureBadge posture="approval_required"/></div>
    <DataGrid title="Orders" columns={columns} rows={short?rows.slice(0,2):rows} rowKey={r=>r.id} virtualize viewportRows={8} filters={[{id:"query",label:"Search",value:filter}]} onFilterChange={(_,value)=>setFilter(value)} sort={sort} onSortChange={(columnId,direction)=>setSort({columnId,direction})} visibleColumnIds={visible} onVisibleColumnIdsChange={setVisible} page={page} pageCount={3} onPageChange={setPage} urlSync={{enabled:true,namespace:"review"}}/>
    <EvidenceTimeline title="Orders" events={[{id:"one",actor:"local-fixture",event:"Review requested",state:"approval_required",timestamp:"2026-10-21T00:00:00Z",correlationId:"cor-ui103-"+"a".repeat(80),details:<p>Local fixture evidence only</p>}]}/>
    <label className="q-field">Callback outcome<select value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="success">success</option><option value="error">error</option><option value="pending">pending</option></select></label>
    <DangerConfirmDialog trigger={<Button variant="danger">Open confirmation</Button>} title="Confirm local fixture action" summary="Local component callback; no business API or venue." impact="Review the irreversible action boundary." confirmPhrase="CONFIRM" confirmLabel="Submit action" mfaRequired correlationId="cor-ui103" onConfirm={async()=>{setCount(c=>c+1);if(outcome==="error")throw new Error("private-upstream-error");if(outcome==="pending")await new Promise(()=>{});}}/>
    <output aria-label="Callback count">{count}</output>
  </main>;
}
function Review(){const {theme}=useTheme(),{locale}=useI18n();return <ThemeProvider key={theme+locale} defaultTheme={theme}><I18nProvider defaultLocale={locale}><Surface/></I18nProvider></ThemeProvider>;}
const meta={title:"integration/UI103",component:Review} satisfies Meta<typeof Review>;export default meta;
type Story=StoryObj<typeof meta>;export const CurrentFunction:Story={};
