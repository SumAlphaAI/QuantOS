"use client";
import {useEffect,useRef,useState} from "react";
import {ThemeProvider} from "@sumalpha/ui";
import {browserAccessEnvironment,createRouteAccess,type RouteContext,type AccessLoss} from "../../src/auth/route-access";
import {sessionStore} from "../../src/auth/flow";
import {settingsCsrf} from "../../src/settings/presentation";
import {createResearchDetailRuntime,type ResearchDetailRuntime} from "../../src/research/detail-runtime";
import {terminalResearch} from "../../src/research/detail-policy";
import {statusLabels} from "../../src/research/policy";
import {researchUtc} from "../../src/research/presentation";
import "./detail.css";
export function ResearchDetailRoute({runId}:{runId:string}){
 const [theme,setTheme]=useState<"dark"|"light">("dark"),[cycle,setCycle]=useState(0),[context,setContext]=useState<RouteContext>(),[loss,setLoss]=useState<AccessLoss>();
 const runtime=useRef<ResearchDetailRuntime>(undefined);
 useEffect(()=>{const media=matchMedia("(prefers-color-scheme: light)");const sync=()=>setTheme(media.matches?"light":"dark");sync();media.addEventListener("change",sync);return()=>media.removeEventListener("change",sync);},[]);
 useEffect(()=>{let active=true;const monitor=createRouteAccess({mock:false,origin:process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN,environment:browserAccessEnvironment(),onInvalidate(next){controller.close();if(active){setContext(undefined);setLoss(next);if(next.status===401||next.reason==="revoked")sessionStore.clear();}}});
 const controller=createResearchDetailRuntime({runId,origin:process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN??"",authorize:monitor.assertCurrent,online:()=>navigator.onLine,csrf:()=>settingsCsrf(document.cookie),invalidate:status=>monitor.invalidate({reason:"revoked",status})});runtime.current=controller;setContext(undefined);setLoss(undefined);
 void controller.load().then(async c=>{await monitor.bind(c);monitor.assertCurrent();if(active)setContext(c);}).catch(e=>{if(active&&!monitor.closed)monitor.invalidate({reason:"unavailable",status:(e as {status?:number}).status});});return()=>{active=false;controller.close();monitor.close();};},[cycle,runId]);
 return <ThemeProvider theme={theme} onThemeChange={setTheme}>{context?<Detail key={cycle} context={context} runtime={runtime.current!} toggle={()=>setTheme(t=>t==="dark"?"light":"dark")}/>:<main className="research-workspace u202" data-route-access={loss?"invalidated":"checking"}><h1>{loss?"访问条件已变化":"正在验证研究详情访问条件"}</h1><p>{loss?"已清除详情、事件、游标与取消意图；恢复不会重放取消请求。结果未知时，请先读取原任务。":"核对当前身份、工作区和研究读取权限。"}</p>{loss?<button onClick={()=>setCycle(x=>x+1)}>重新验证访问条件</button>:null}<a href="/research">返回 Research 列表</a></main>}</ThemeProvider>;
}
const streamLabels={idle:"尚未连接",connecting:"正在连接",live:"已收到有效事件",recovering:"正在从确认游标回补",paused:"已暂停",complete:"任务已终态，流已停止",unavailable:"流不可用，请显式恢复"};
function Detail({context,runtime,toggle}:{context:RouteContext;runtime:ResearchDetailRuntime;toggle:()=>void}){
 const [view,setView]=useState(runtime.view),[tick,setTick]=useState(Date.now()),[confirm,setConfirm]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const unsubscribe=runtime.subscribe(setView);void runtime.refresh().catch(()=>{});const timer=setInterval(()=>setTick(Date.now()),500);return()=>{unsubscribe();clearInterval(timer);};},[runtime]);
 useEffect(()=>{if(confirm)dialog.current?.showModal();},[confirm]);
 const run=view.run,blocked=view.busy||tick<view.retryAt,canWrite=context.capabilities.includes("research.write"),cancelable=run&&!terminalResearch(run)&&run.status!=="cancel_requested"&&!view.receipt;
 const closeDialog=()=>{dialog.current?.close();setConfirm(false);trigger.current?.focus();};
 const cancel=()=>{closeDialog();void runtime.cancel().catch(()=>{});};
 return <main className="research-workspace u202" data-route-access="authorized"><header><div><nav aria-label="Research 导航"><a href="/research">Research 列表</a><a href="/command">Command</a></nav><h1>Research 详情</h1></div><button onClick={toggle}>切换主题</button></header>
 <p>详情以 C03 读取结果为准；事件仅触发重读，不推断进度、健康或完成。</p>
 <div className="u202-actions"><button disabled={blocked} onClick={()=>{void runtime.refresh().catch(()=>{});}}>刷新详情并恢复事件流</button>{canWrite&&cancelable&&!view.uncertain?<button ref={trigger} disabled={blocked} onClick={()=>setConfirm(true)}>请求取消研究</button>:null}{canWrite&&view.uncertain?<button disabled={blocked} onClick={()=>{void runtime.cancel().catch(()=>{});}}>以原请求重试取消</button>:null}</div>
 {view.uncertain?<p role="alert">取消结果未知。只可显式重试原任务与原幂等键；离开后请先读取原任务，恢复访问不会重放。</p>:null}
 {tick<view.retryAt?<p role="status">请求过于频繁，请在冷却结束后显式重试。</p>:null}
 {view.error?<p role="alert">{view.error===403||view.error===404?"资源不存在或无权访问。":view.error===409?"任务状态冲突，请刷新详情核对。":view.error===429?"服务端限流，稍后显式重试。":"研究详情或事件流不可用，未显示未验证的结果。"}</p>:null}
 <section aria-label="事件连接状态" aria-live="polite"><h2>事件连接</h2><p>{streamLabels[view.stream]}</p><p>最后确认序号：<output data-testid="research-sequence">{view.sequence}</output> · 游标仅在当前授权与页面内存中保留</p>{view.gap?<p>发现序号缺口：期望 {view.gap.expected}，收到 {view.gap.got}；从最后确认位置回补。</p>:null}</section>
 {view.receipt?<section aria-label="取消受理回执"><h2>202 取消请求已受理</h2><p>受理不等于已取消；最终状态须由详情重读确认。</p><dl><dt>受理状态</dt><dd>{view.receipt.status}</dd><dt>任务 ID</dt><dd>{view.receipt.jobId}</dd><dt>关联 ID</dt><dd>{view.receipt.correlationId}</dd><dt>审计引用</dt><dd>{view.receipt.auditRef}</dd></dl><a href={`/audit/${view.receipt.correlationId}`}>查看取消审计</a></section>:null}
 {run?<><section aria-label="研究任务详情"><h2>任务事实</h2><p data-testid="research-status">{statusLabels[run.status]}（服务端 {run.status}）</p><dl>{Object.entries({"任务 ID":run.runId,"研究能力":run.capability,"预算成本单位":run.budget,"实际成本单位":run.costUnits??"未提供","截止时间 UTC":researchUtc(run.deadlineAt),"创建时间 UTC":researchUtc(run.createdAt),"输入哈希":run.inputHash,"引擎版本":run.engineVersion,"关联 ID":run.correlationId,"审计引用":run.auditRef??"未提供"}).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><a href={`/data-snapshots/${run.dataSnapshotId}`}>查看输入快照</a><a href={`/audit/${run.correlationId}`}>查看研究审计</a><h3>Artifact 引用</h3><ul>{run.artifactRefs?.map(id=><li key={id}>{id}</li>)}</ul>{!run.artifactRefs?.length?<p>当前响应未返回产物引用。</p>:null}<h3>Evidence 引用</h3><ul>{run.evidenceRefs.map(id=><li key={id}>{id}</li>)}</ul>{!run.evidenceRefs.length?<p>当前响应未返回证据引用。</p>:null}<p>引用仅按接口展示；Artifact/Evidence 详情由 UI-203 交付。</p></section></>:!view.error?<p role="status">正在读取授权详情。</p>:null}
 <section aria-label="研究事件"><h2>已确认事件</h2><p>仅展示最近 200 条通知的引用与时间，不展示未经定义的原始载荷。</p><ol>{view.events.map(e=><li key={e.eventId} data-sequence={e.sequence}><strong>#{e.sequence} {e.kind}</strong><dl><dt>事件 ID</dt><dd>{e.eventId}</dd><dt>时间 UTC</dt><dd>{researchUtc(e.occurredAt)}</dd><dt>关联 ID</dt><dd>{e.correlationId}</dd></dl></li>)}</ol></section>
 {confirm?<dialog ref={dialog} aria-labelledby="u202-confirm-title" onCancel={e=>{e.preventDefault();closeDialog();}}><h2 id="u202-confirm-title">确认请求取消研究</h2><p>请求只针对当前任务；202 表示受理，不能保证任务已停止。</p><p>{run?.runId}</p><button autoFocus onClick={closeDialog}>继续研究</button><button disabled={blocked} onClick={cancel}>确认请求取消</button></dialog>:null}
 </main>;
}
