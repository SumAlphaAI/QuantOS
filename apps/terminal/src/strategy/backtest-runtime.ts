import {bffZodSchemas,createBffClient,consumeSse} from "@sumalpha/api-client";
import {createStrategyRuntime,StrategyError} from "./runtime";
import {BacktestReducer,checkedReport,terminalBacktest,type BacktestReport} from "./backtest-policy";
export function createBacktestRuntime(config:{origin:string;runId:string;authorize:()=>void;online:()=>boolean;csrf:()=>string;invalidate:(status:number)=>void;fetchImpl?:typeof fetch;timeoutMs?:number;idleMs?:number;retryDelayMs?:number;maxReconnects?:number}){
 bffZodSchemas.UUID.parse(config.runId);
 const identity=createStrategyRuntime(config),life=new AbortController(),client=createBffClient({baseUrl:config.origin,fetch:config.fetchImpl,signal:life.signal,timeoutMs:config.timeoutMs??10000}),listeners=new Set<()=>void>();
 let report:ReturnType<typeof checkedReport>|undefined,baseline:BacktestReport|undefined,reducer:BacktestReducer|undefined,stream:"idle"|"connecting"|"live"|"recovering"|"complete"|"unavailable"="idle",error:number|undefined,busy=false,watcher:AbortController|undefined,closed=false;
 const emit=()=>listeners.forEach(f=>f());
 const guard=()=>{identity.assertCurrent();if(closed)throw new StrategyError(403);};
 function failure(e:unknown){const status=(e as {status?:number}).status;report=undefined;error=status??502;if(status===401||status===403)config.invalidate(status);emit();}
 async function read(){guard();const r=await client.GET("/v1/backtests/{runId}",{params:{path:{runId:config.runId}},cache:"no-store"});guard();if(r.response.status!==200||!r.data)throw new StrategyError(r.response.status);const next=checkedReport(r.data,config.runId,baseline);if(report&&next.strategyId!==report.strategyId)throw new StrategyError(502);if(next.status==="succeeded")baseline=next as BacktestReport;report=next;error=undefined;emit();}
 async function watch(){if(watcher||!report)return;const controller=new AbortController();watcher=controller;const signal=AbortSignal.any([controller.signal,life.signal]);reducer??=new BacktestReducer(config.runId,report.strategyId,baseline);stream="connecting";emit();let timer:ReturnType<typeof setTimeout>|undefined;
 const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),config.idleMs??30000);};arm();
 const bounded:typeof fetch=async(input,init)=>{guard();const r=await(config.fetchImpl??fetch)(input,init);guard();if(!r.ok||!r.body)return r;if(!r.headers.get("content-type")?.includes("text/event-stream")){await r.body.cancel();throw new StrategyError(502);}let buffer="";const decoder=new TextDecoder("utf-8",{fatal:true});return new Response(r.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,out){buffer+=decoder.decode(chunk,{stream:true});let i;while((i=buffer.search(/\r?\n\r?\n/))>=0){if(i>65536)throw new StrategyError(502);buffer=buffer.slice(i+(buffer[i]==="\r"?4:2));}if(buffer.length>65536)throw new StrategyError(502);out.enqueue(chunk);}})),{headers:r.headers,status:r.status});};
 try{for await(const action of consumeSse({url:new URL(`/v1/backtests/${config.runId}/stream`,config.origin).href,reducer,signal,fetchImpl:bounded,maxReconnects:config.maxReconnects??5,retryDelayMs:config.retryDelayMs??250})){guard();if(action.type==="closed"){failure(new StrategyError(403));return;}if(action.type==="gap"){stream="recovering";emit();continue;}if(action.type!=="apply")continue;arm();stream="live";await read();if(report&&terminalBacktest(report.status)){stream="complete";emit();return;}}}
 catch(e){if(!closed&&watcher===controller){stream="unavailable";failure(e);}}finally{clearTimeout(timer);if(watcher===controller)watcher=undefined;}
 }
 return{assertCurrent:guard,get view(){return {report:report&&structuredClone(report),busy,stream,error,sequence:reducer?.resumeAfter??0};},subscribe(f:()=>void){listeners.add(f);return()=>{listeners.delete(f);};},load:identity.load,
 async refresh(){guard();if(busy)throw new StrategyError(409);watcher?.abort();watcher=undefined;busy=true;error=undefined;emit();try{await identity.load();await read();}catch(e){if(!closed)failure(e);throw e;}finally{busy=false;emit();}void watch();},
 close(){closed=true;watcher?.abort();life.abort();identity.close();report=undefined;baseline=undefined;reducer=undefined;listeners.clear();}};
}
export type BacktestRuntime=ReturnType<typeof createBacktestRuntime>;
