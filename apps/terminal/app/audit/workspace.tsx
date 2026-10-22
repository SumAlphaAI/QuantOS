"use client";
import {useEffect,useRef,useState, type FormEvent} from "react";
import {ThemeProvider} from "@sumalpha/ui";
import {browserAccessEnvironment,createRouteAccess,type AccessLoss,type RouteContext} from "../../src/auth/route-access";
import {handleAuthHttpStatus,sessionStore} from "../../src/auth/flow";
import {settingsCsrf} from "../../src/settings/presentation";
import {createAuditRuntime,type AuditRuntime} from "../../src/audit/runtime";
import type {AuditEventPage,EvidenceChainPage,ExportJob,ExportRequest} from "../../src/audit/gateway";
import "./workspace.css";
export function AuditRoute({exportsOnly=false}:{exportsOnly?:boolean}) {
  const [cycle,setCycle]=useState(0),[context,setContext]=useState<RouteContext>(),[loss,setLoss]=useState<AccessLoss>();
  const runtime=useRef<AuditRuntime>(undefined), access=useRef<ReturnType<typeof createRouteAccess>>(undefined);
  useEffect(()=>{
    let active=true;
    const monitor=createRouteAccess({mock:false,origin:process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN,environment:browserAccessEnvironment(),onInvalidate(next){
      controller.close();if(!active)return;setContext(undefined);setLoss(next);
      if(next.status===401||next.reason==="revoked")sessionStore.clear();
      if(next.status===401||next.status===403||next.status===404){const decision=handleAuthHttpStatus(next.status,exportsOnly?"/exports":"/audit");if("route"in decision)window.location.replace(decision.route);}
    }});
    const controller=createAuditRuntime({origin:process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN??"",authorize:monitor.assertCurrent,online:()=>navigator.onLine,width:()=>window.innerWidth,csrf:()=>settingsCsrf(document.cookie)});
    runtime.current=controller;access.current=monitor;setContext(undefined);setLoss(undefined);
    if(!navigator.onLine||document.hidden)monitor.invalidate({reason:!navigator.onLine?"offline":"hidden"});
    else void controller.load().then(async c=>{if(!active)return;await monitor.bind(c);monitor.assertCurrent();if(active)setContext(c);}).catch(error=>{if(active&&!monitor.closed)monitor.invalidate({reason:"unavailable",status:(error as {status?:number}).status});});
    return()=>{active=false;controller.close();monitor.close();runtime.current=undefined;access.current=undefined;};
  },[cycle,exportsOnly]);
  return <ThemeProvider theme="dark">{!context?<main className="audit-workspace" data-route-access={loss?"invalidated":"checking"}><h1>{loss?"访问条件已变化":"正在验证审计访问条件"}</h1><p>{loss?"已清除审计记录、草稿和下载租约。恢复后请重新验证，操作不会自动重放。":"正在验证会话、工作区和审计权限。"}</p>{loss?<button onClick={()=>setCycle(c=>c+1)}>重新验证访问条件</button>:null}</main>:<AuditWorkspace key={cycle} context={context} runtime={runtime.current!} exportsOnly={exportsOnly} publish={async()=>{await access.current!.bind(context,runtime.current!.deadline);access.current!.assertCurrent();}} onDenied={status=>access.current?.invalidate({reason:"unavailable",status})}/>}</ThemeProvider>;
}
function AuditWorkspace({context,runtime,exportsOnly,publish,onDenied}:{context:RouteContext;runtime:AuditRuntime;exportsOnly:boolean;publish:()=>Promise<void>;onDenied:(status:number)=>void}) {
  const [events,setEvents]=useState<AuditEventPage>(),[chain,setChain]=useState<EvidenceChainPage>(),[job,setJob]=useState<ExportJob>();
  const [correlation,setCorrelation]=useState(""),[causation,setCausation]=useState(""),[kind,setKind]=useState(""),[objectRef,setObjectRef]=useState(""),[start,setStart]=useState(""),[end,setEnd]=useState("");
  const [exportScope,setExportScope]=useState(""),[pageSize,setPageSize]=useState(25);
  const [format,setFormat]=useState<ExportRequest["format"]>("jsonl"),[reason,setReason]=useState(""),[watermark,setWatermark]=useState(""),[days,setDays]=useState(7),[code,setCode]=useState(""),[exportId,setExportId]=useState("");
  const [width,setWidth]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[tick,setTick]=useState(Date.now());
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;const resize=()=>setWidth(window.innerWidth);resize();window.addEventListener("resize",resize);const interval=setInterval(()=>setTick(Date.now()),1000);return()=>{mounted.current=false;window.removeEventListener("resize",resize);clearInterval(interval);};},[]);
  async function run<T>(action:()=>Promise<T>,accept:(value:T)=>void) {
    if(busy)return;setBusy(true);setMessage("");
    try {const result=await action();await publish();if(mounted.current)accept(result);}
    catch(error){if(!mounted.current)return;const e=error as {status?:number;outcomeUnknown?:boolean};
      if(e.status===401||e.status===403||e.status===404){onDenied(e.status);return;}
      if(e.status===410){setEvents(undefined);setChain(undefined);setJob(undefined);}
      setMessage(e.outcomeUnknown?"请求结果未知。未自动重放；请保留原内容，以相同业务意图显式重试。":e.status===429?"请求过于频繁，请等待后显式重试。":e.status===422?"输入或 MFA 验证未通过，请核对后重试。":e.status===409?"当前状态不支持此操作；若上次结果未知，请保持原内容显式重试。":"请求未完成，请核对条件后显式重试。");
    } finally {if(mounted.current){setBusy(false);setCode("");}}
  }
  useEffect(()=>{
    const q=new URLSearchParams(window.location.search),c=q.get("correlationId"),e=q.get("exportId");
    if(c){setCorrelation(c);setExportScope(c);void run(()=>runtime.evidence(c),setChain);}
    else if(e){setExportId(e);void run(()=>runtime.status(e),setJob);}
    else if(!exportsOnly)void run(()=>runtime.search(),setEvents);
    // One initial read per mounted, authorized route. Recovery mounts a fresh workspace.
  },[]);
  const write=context.capabilities.includes("audit:export"), desktop=width>=768, cooling=tick<runtime.retryAt;
  const create=(event:FormEvent)=>{event.preventDefault();void run(()=>runtime.create({scope:{correlationIds:exportScope.split(",").map(v=>v.trim())},format,reason,watermark,retentionDays:days},code),next=>{setJob(next);setExportId(next.exportId);setMessage("导出已受理；请查询服务端状态，受理不代表文件就绪。");});};
  return <main className="audit-workspace" data-route-access="authorized" aria-busy={busy}>
    <nav aria-label="审计导航"><a href="/command">Command</a><a href="/audit">Audit Explorer</a><a href="/exports">导出作业</a><a href="/settings/browser">下载记录</a></nav>
    <h1>{exportsOnly?"受控导出":"Audit Explorer"}</h1><p>只显示当前授权范围内的服务端脱敏记录。证据哈希不替代资源授权。</p>
    <div role="status" aria-live="polite">{message}{cooling?` 等待 ${Math.ceil((runtime.retryAt-tick)/1000)} 秒。`:""}</div>
    {!exportsOnly&&<><section aria-label="审计搜索"><h2>服务端搜索</h2><form onSubmit={event=>{event.preventDefault();setChain(undefined);setEvents(undefined);void run(()=>runtime.search({correlationId:correlation||undefined,causationId:causation||undefined,kind:kind||undefined,objectRef:objectRef||undefined,startAt:start?new Date(start).toISOString():undefined,endAt:end?new Date(end).toISOString():undefined,pageSize}),setEvents);}}>
      <label>Correlation ID<input value={correlation} onChange={e=>setCorrelation(e.target.value)} /></label><label>Causation ID<input value={causation} onChange={e=>setCausation(e.target.value)} /></label><label>事件类型<input value={kind} onChange={e=>setKind(e.target.value)} /></label><label>对象引用<input value={objectRef} onChange={e=>setObjectRef(e.target.value)} /></label><label>开始时间<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} /></label><label>结束时间<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} /></label><label>每页条数<select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}>{[5,25,50,100].map(size=><option key={size} value={size}>{size}</option>)}</select></label><button disabled={busy}>搜索</button>
    </form>{events&&<><p>{events.items.length===0?"没有匹配的审计记录。":`本页 ${events.items.length} 条记录`}</p><div className="audit-table"><table><caption>审计事件</caption><thead><tr><th>序号 / 时间</th><th>事件 / 对象</th><th>关联与因果</th><th>脱敏载荷</th></tr></thead><tbody>{events.items.map(item=><tr key={item.eventId}><td>{item.sequence}<br/>{item.occurredAt}</td><td>{item.kind}<br/>{item.objectRef}<br/>{item.actor}</td><td><button disabled={busy} onClick={()=>{setCorrelation(item.correlationId);if(!runtime.uncertain)setExportScope(item.correlationId);setChain(undefined);void run(()=>runtime.evidence(item.correlationId),setChain);}}>查看因果链</button><br/><code>{item.correlationId}</code><br/>causation: {item.causationId??"根事件"}</td><td><details><summary>已脱敏载荷</summary><pre>{JSON.stringify(item.redactedPayload,null,2)}</pre><code>{item.payloadHash}</code><p>保留至 {item.retentionUntil}</p></details></td></tr>)}</tbody></table></div><button disabled={busy||!events.nextCursor} onClick={()=>void run(()=>runtime.search({},true),setEvents)}>下一页事件</button></>}</section>
    <section aria-label="因果证据链"><h2>因果证据链</h2><button disabled={busy||!correlation} onClick={()=>{setChain(undefined);void run(()=>runtime.evidence(correlation),setChain);}}>读取关联链</button>{chain&&<><p>Correlation: <code>{chain.correlationId}</code></p><p>{chain.complete&&!chain.nextCursor?"当前授权范围内链完整":"链尚不完整；继续读取或核对权限范围"}</p><ol>{chain.items.map(item=><li key={item.eventId}><strong>{item.kind}</strong> · #{item.sequence}<p>event: <code>{item.eventId}</code> → causation: <code>{item.causationId??"根事件"}</code>{item.causationId&&!chain.items.some(n=>n.eventId===item.causationId)?"（父事件不在已加载范围内）":""}</p><p>{item.objectRef} · {item.occurredAt}</p><code>{item.payloadHash}</code></li>)}</ol><button disabled={busy||!chain.nextCursor} onClick={()=>void run(()=>runtime.evidence(chain.correlationId,true),setChain)}>继续读取证据链</button></>}</section></>}
    <section aria-label="创建受控导出"><h2>创建受控导出</h2><p>仅导出显式填写的 Correlation 范围，不将当前搜索页当作全部结果。链接仅在点击下载时申请，不保存到历史。</p>{!write||!desktop?<p>{!desktop?"小屏仅支持审计查询和已授权下载；请在桌面创建或取消导出。":"当前身份没有 audit:export 权限。"}</p>:<form onSubmit={create}>
      <label>导出 Correlation IDs（逗号分隔）<input required value={exportScope} disabled={busy||runtime.uncertain} onChange={e=>setExportScope(e.target.value)}/></label><label>导出格式<select value={format} disabled={busy||runtime.uncertain} onChange={e=>setFormat(e.target.value as ExportRequest["format"])}><option value="jsonl">JSONL</option><option value="csv">CSV</option><option value="pdf">PDF</option></select></label><label>导出理由<input required minLength={8} maxLength={500} value={reason} disabled={busy||runtime.uncertain} onChange={e=>setReason(e.target.value)}/></label><label>水印<input required minLength={3} maxLength={120} value={watermark} disabled={busy||runtime.uncertain} onChange={e=>setWatermark(e.target.value)}/></label><label>保留天数<input type="number" min={1} max={30} required value={days} disabled={busy||runtime.uncertain} onChange={e=>setDays(Number(e.target.value))}/></label><label>MFA 验证码<input type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/></label><button disabled={busy||cooling||!/^\d{6}$/.test(code)}>确认创建导出</button>
    </form>}</section>
    <section aria-label="导出作业状态"><h2>导出作业状态</h2><form onSubmit={e=>{e.preventDefault();setJob(undefined);void run(()=>runtime.status(exportId),setJob);}}><label>Export ID<input required value={exportId} onChange={e=>setExportId(e.target.value)}/></label><button disabled={busy}>查询作业状态</button></form>{job&&<article><h3>作业 <code>{job.exportId}</code></h3><p data-export-status={job.status}>状态：{job.status}</p><p>格式：{job.format} · 水印：{job.watermark} · 保留至 {job.retentionUntil}</p><p>审计引用：<code>{job.auditRef}</code></p><a href={`/audit?correlationId=${encodeURIComponent(job.correlationId)}`}>查看导出审计链</a> <a href={`/exports?exportId=${encodeURIComponent(job.exportId)}`}>作业永久引用</a><div>
      {desktop&&<button disabled={busy||cooling||!write||!["queued","generating","ready"].includes(job.status)||Date.parse(job.retentionUntil)<=tick||!/^\d{6}$/.test(code)} onClick={()=>void run(()=>runtime.cancel(job.exportId,code),next=>{setJob(next);setMessage("取消已受理；请查询服务端最终状态。");})}>确认取消导出（使用 MFA）</button>}
      <button disabled={busy||cooling||!write||job.status!=="ready"||Date.parse(job.retentionUntil)<=tick} onClick={()=>void run(()=>runtime.download(job.exportId,metadata=>{const anchor=document.createElement("a");anchor.href=metadata.downloadUrl;anchor.rel="noopener noreferrer";anchor.referrerPolicy="no-referrer";anchor.download="";document.body.append(anchor);anchor.click();anchor.remove();}),result=>setMessage(`已交给浏览器接收；预期 ${result.sizeBytes} 字节，SHA-256 ${result.sha256}。请核对浏览器下载结果。`))}>申请短时下载</button>
    </div></article>}</section>
  </main>;
}
