"use client";
import {useState,type ReactNode} from "react";
import {TerminalFrame} from "@sumalpha/ui";
import {TerminalHeader,TerminalNavigation} from "@sumalpha/domain-ui/chrome";
import {visibleShellNavigation} from "@sumalpha/domain-ui/ui101";
import {commandNavigationCapabilities} from "../../src/command/presentation";
import type {RouteContext} from "../../src/auth/route-access";
import "./p04.css";
export function P04Frame({context,status,children}:{context:RouteContext;status:string;children:ReactNode}){
 const [collapsed,setCollapsed]=useState(false);
 const nav=visibleShellNavigation([...commandNavigationCapabilities(context.capabilities),...(context.capabilities.includes("research.read")?["research:read" as const]:[])]).map(item=>({...item,badge:undefined}));
 return <TerminalFrame className="p04-shell" collapsed={collapsed} data-route-access="authorized" mainClassName="p04-main" mainMarker="ui-p04"
 header={<TerminalHeader workspace={`Workspace ${context.workspaceId.slice(0,8)}`} workspaceTitle={context.workspaceId} account={`Account ${context.accountId.slice(0,8)}`} accountTitle={context.accountId} initials={context.actorId.slice(0,2).toUpperCase()} mode={context.mode} collapsed={collapsed} onToggle={()=>setCollapsed(v=>!v)} notifications={null} readOnlyControls helpHref="#p04-help"/>}
 navigation={<TerminalNavigation items={nav} activeRoute="/research"/>}
 status={<><span>Connection: Authorized</span><span>{status}</span><span>当前授权范围 · 研究用途</span></>}>{children}</TerminalFrame>;
}
export function P04Copy({value,authorize}:{value:string;authorize:()=>unknown}){
 const [message,setMessage]=useState("");
 return <span className="p04-copy"><button onClick={()=>{try{authorize();void navigator.clipboard.writeText(value).then(()=>{authorize();setMessage("已复制关联 ID");}).catch(()=>setMessage("复制未完成，请从元数据选择关联 ID"));}catch{setMessage("访问条件已变化，请重新验证");}}}>复制关联 ID</button><span role="status">{message}</span></span>;
}
