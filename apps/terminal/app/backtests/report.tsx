"use client";
import {useEffect,useRef,useState} from "react";
import {ThemeProvider} from "@sumalpha/ui";
import {createRouteAccess,browserAccessEnvironment,type RouteContext,type AccessLoss} from "../../src/auth/route-access";
import {sessionStore} from "../../src/auth/flow";
import {settingsCsrf} from "../../src/settings/presentation";
import {createBacktestRuntime,type BacktestRuntime} from "../../src/strategy/backtest-runtime";
import {backtestLocation,reportSchema,releaseReadiness} from "../../src/strategy/backtest-policy";
import {ReleaseCreatePanel} from "../releases/create-panel";
import "../strategies/workspace.css";
import {P07Frame,BacktestDashboard,P07StateSurface,useP07Theme} from "./p07-components";
export function BacktestEntry(){
 const {theme,setTheme}=useP07Theme();
 const [context,setContext]=useState<RouteContext>();
 const [cycle,setCycle]=useState(0),[ready,setReady]=useState(false),[invalid,setInvalid]=useState(false),[loss,setLoss]=useState<AccessLoss>(),[,update]=useState(0),runtime=useRef<BacktestRuntime>(undefined),denied=useRef<(status:number)=>void>(()=>{});
 useEffect(()=>{let runId:string;try{runId=backtestLocation(location.pathname,location.search);}catch{setInvalid(true);return;}let active=true;
 const monitor=createRouteAccess({mock:false,origin:process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN,environment:browserAccessEnvironment(),onInvalidate(next){controller.close();if(active){setReady(false);setLoss(next);if(next.status===401)sessionStore.clear();}}});
 const controller=createBacktestRuntime({origin:process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN??"",runId,authorize:monitor.assertCurrent,online:()=>navigator.onLine,csrf:()=>settingsCsrf(document.cookie),invalidate:status=>monitor.invalidate({reason:"revoked",status})});runtime.current=controller;denied.current=status=>monitor.invalidate({reason:"revoked",status});setReady(false);setLoss(undefined);const off=controller.subscribe(()=>{if(active)update(v=>v+1);});
 void controller.load().then(async c=>{await monitor.bind(c);monitor.assertCurrent();if(active){setContext(c);setReady(true);await controller.refresh().catch(()=>{});}}).catch(e=>{if(active&&!monitor.closed)monitor.invalidate({reason:"unavailable",status:(e as {status?:number}).status});});
 return()=>{active=false;off();controller.close();monitor.close();};},[cycle]);
 const view=runtime.current?.view,r=view?.report,parsed=reportSchema.safeParse(r),p=parsed.success?parsed.data:undefined,gate=releaseReadiness(r);
 return <ThemeProvider theme={theme} onThemeChange={setTheme}>{invalid?<P07StateSurface state="unauthorized" title="回测引用无效" description="请从实验队列打开有效任务。"/>:!ready||!context?<P07StateSurface state={!loss?"loading":loss.reason==="offline"?"offline":loss.reason==="expired"||loss.status===401?"stale":loss.status===403?"unauthorized":"error"} title={loss?"报告访问条件已变化":"正在验证回测访问权限"} description="身份与工作区验证后读取报告；不会创建或重放任务。" retry={loss?()=>setCycle(v=>v+1):undefined}/>:<P07Frame context={context} toggle={()=>setTheme(v=>v==="dark"?"light":"dark")}><div data-testid="backtest-report"><header className="p07-heading"><div><nav className="p07-breadcrumb" aria-label="回测导航"><a href="/strategies">Strategy</a><span>/</span>{r?<a href={`/strategies/${r.strategyId}/lab`}>Strategy Lab</a>:null}<span>/ Backtest</span></nav><h1>Backtest Report</h1><div className="p07-subtitle"><span className="p07-volatile">{r?.runId}</span><span className={`p07-badge ${r?.status==='succeeded'?'p07-good':''}`}>{r?.status??"读取中"}</span>{gate.ready?<span className="p07-badge p07-good">报告核对通过</span>:null}</div></div></header><div className="p07-toolbar"><button disabled={view?.busy} onClick={()=>{void runtime.current?.refresh().catch(()=>{});}}>刷新报告与事件流</button><button disabled title="需比较接口">比较回测</button><span role="status">{view?.busy?"读取中":`事件流：${view?.stream} · 已确认序号 ${view?.sequence}`}</span></div><p className="p07-risk"><strong>ⓘ 回测结果不等于可部署策略。</strong>固定输入、回测与审批须逐项核对。</p>{view?.error?<p role="alert">报告不可用（{view.error}）。请核对任务引用、授权或稍后显式刷新。</p>:null}<div className="p07-split"><BacktestDashboard raw={r}/><aside className="p07-drawer" aria-label="Strategy Release">{p&&gate.ready?<ReleaseCreatePanel runId={p.runId} authorize={()=>runtime.current!.assertCurrent()} invalidate={status=>denied.current(status)}/>:<section className="p07-panel"><h2>Strategy Release</h2><p>尚无完整可验证的报告；创建不可变候选被阻断。</p></section>}</aside></div></div></P07Frame>}</ThemeProvider>;
}
