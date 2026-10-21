"use client";

import { useId, type HTMLAttributes, type ReactNode } from "react";
import { InlineAlert } from "./InlineAlert/InlineAlert";
import { translate, useOptionalI18n } from "../i18n/I18nProvider";

/** Presentation slots only; permissions and business state belong to the caller. */
export interface TerminalFrameProps extends HTMLAttributes<HTMLDivElement> {
  header: ReactNode; navigation: ReactNode; status: ReactNode; children: ReactNode;
  collapsed?: boolean; mainClassName?: string; mainMarker?: string;
}
export function TerminalFrame({header,navigation,status,children,collapsed=false,mainClassName="",mainMarker,...props}:TerminalFrameProps){
 const id=useId();return <div {...props} className={`q-terminal-frame terminal-shell${collapsed?" sidebar-collapsed":""}${props.className?` ${props.className}`:""}`}>
  <a className="q-skip-link" href={`#${id}`}>{useOptionalI18n()?.locale==="en"?"Skip to content":"跳至正文"}</a>
  <header className="terminal-topbar">{header}</header><aside className="terminal-sidebar" aria-label="主导航">{navigation}</aside>
  <main id={id} tabIndex={-1} className={`q-workspace-main ${mainClassName}`} data-smoke={mainMarker}>{children}</main>
  <footer className="terminal-statusbar" aria-label="连接状态">{status}</footer>
 </div>;
}
export function WorkspacePanel({title,actions,children,className="",...props}:HTMLAttributes<HTMLElement>&{title:string;actions?:ReactNode}){const id=useId();return <section {...props} className={`q-workspace-panel ${className}`} aria-labelledby={id}><header className="q-workspace-panel__header"><h2 id={id}>{title}</h2>{actions}</header><div className="q-workspace-panel__body">{children}</div></section>;}
export function WorkspaceGrid({children,className="",...props}:HTMLAttributes<HTMLDivElement>){return <div {...props} className={`q-workspace-grid ${className}`}>{children}</div>;}
export function WorkspaceField({label,hint,error,children}: {label:string;hint?:string;error?:string;children:(inputProps:{id:string;"aria-describedby"?:string;"aria-invalid"?:true})=>ReactNode}){const id=useId();return <div className="q-field"><label htmlFor={id}>{label}</label>{children({id,"aria-describedby":hint||error?id+'-help':undefined,"aria-invalid":error?true:undefined})}{hint||error?<p id={id+'-help'} className="q-muted" role={error?"alert":undefined}>{error??hint}</p>:null}</div>;}
export type ChartPoint={label:string;value:number};
/** A labelled figure plus native data table; no live feed or business computation. */
export function WorkspaceChart({title,points}:{title:string;points:ChartPoint[]}){
 const id=useId(),locale=useOptionalI18n()?.locale??'zh-CN';const valid=points.length>0&&points.every(p=>Number.isFinite(p.value));
 if(!valid)return <InlineAlert tone="warning" title={title}>{translate(locale,'state.unavailable')}</InlineAlert>;
 const scale=points.reduce((max,p)=>Math.max(max,Math.abs(p.value)),1),values=points.map(p=>p.value/scale);
 const low=Math.min(...values),range=Math.max(...values)-low||1;
 return <figure className="q-workspace-chart" aria-labelledby={id}><figcaption id={id}>{title}</figcaption><svg viewBox="0 0 400 120" role="img" aria-labelledby={id}><polyline fill="none" stroke="var(--q-chart-line)" strokeWidth="2" points={points.map((p,i)=>`${points.length===1?200:i/(points.length-1)*380+10},${110-(p.value/scale-low)/range*100}`).join(' ')}/></svg><details><summary>{locale==='en'?'Chart data':'图表数据'}</summary><table className="q-table"><caption>{title}</caption><thead><tr><th scope="col">{locale==='en'?'Time':'时间'}</th><th scope="col">{locale==='en'?'Value':'数值'}</th></tr></thead><tbody>{points.map((p,i)=><tr key={i}><th scope="row">{p.label}</th><td className="q-mono">{p.value}</td></tr>)}</tbody></table></details></figure>;
}
