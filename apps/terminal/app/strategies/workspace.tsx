"use client";
import {useEffect,useRef,useState} from "react";
import {ThemeProvider,TerminalFrame} from "@sumalpha/ui";
import {TerminalHeader,TerminalNavigation} from "@sumalpha/domain-ui/chrome";
import {visibleShellNavigation} from "@sumalpha/domain-ui/ui101";
import {browserAccessEnvironment,createRouteAccess,type RouteContext,type AccessLoss} from "../../src/auth/route-access";
import {sessionStore} from "../../src/auth/flow";
import {settingsCsrf} from "../../src/settings/presentation";
import {commandNavigationCapabilities} from "../../src/command/presentation";
import {createStrategyRuntime,type StrategyRuntime} from "../../src/strategy/runtime";
import {autosaveMs,parseDraftContent,strategyLocation,strategyLabPath,type StrategySummary} from "../../src/strategy/policy";
import "./workspace.css";
type Location = ReturnType<typeof strategyLocation>;
const pretty = (v: unknown) => v === undefined ? "（不存在）" : JSON.stringify(v,null,2);
export function StrategyEntry() {
 const [route,setRoute] = useState<Location>(),[invalid,setInvalid] = useState(false);
 useEffect(() => {try {setRoute(strategyLocation(location.pathname,location.search));} catch {setInvalid(true);}},[]);
 if (invalid) return <main><h1>Strategy 引用无效</h1><a href="/strategies">返回策略目录</a></main>;
 return route ? <StrategyRoute route={route}/> : <main><h1>正在解析 Strategy 路由</h1></main>;
}
function StrategyRoute({route}: {route: Location}) {
 const [cycle,setCycle] = useState(0),[context,setContext] = useState<RouteContext>(),[loss,setLoss] = useState<AccessLoss>(),[theme,setTheme] = useState<"dark" | "light">("dark");
 const runtime = useRef<StrategyRuntime>(undefined),access = useRef<ReturnType<typeof createRouteAccess>>(undefined);
 useEffect(() => {const media = matchMedia("(prefers-color-scheme: light)");const sync = () => setTheme(media.matches ? "light" : "dark");sync();media.addEventListener("change",sync);return () => media.removeEventListener("change",sync);},[]);
 useEffect(() => {
  let active = true;
  const monitor = createRouteAccess({mock:false,origin:process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN,environment:browserAccessEnvironment(),onInvalidate(next) {controller.close();if (active) {setContext(undefined);setLoss(next);if (next.status === 401 || next.reason === "revoked") sessionStore.clear();}}});
  const controller = createStrategyRuntime({origin:process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN ?? "",authorize:monitor.assertCurrent,online:() => navigator.onLine,csrf:() => settingsCsrf(document.cookie)});
  runtime.current = controller;access.current = monitor;setContext(undefined);setLoss(undefined);
  void controller.load().then(async c => {await monitor.bind(c);monitor.assertCurrent();if (active) setContext(c);}).catch(e => {if (active && !monitor.closed) monitor.invalidate({reason:"unavailable",status:(e as {status?: number}).status});});
  return () => {active = false;controller.close();monitor.close();};
 },[cycle]);
 return <ThemeProvider theme={theme} onThemeChange={setTheme}>{context ? <StrategyWorkspace key={cycle} route={route} context={context} runtime={runtime.current!} denied={s => access.current?.invalidate({reason:"revoked",status:s})}/> : <main className="strategy-workspace" data-route-access={loss ? "invalidated" : "checking"}><h1>{loss ? "访问条件已变化" : "正在验证 Strategy 访问条件"}</h1><p>{loss ? "内存草稿已清除。恢复后先读取服务端版本；不会重放保存。离开前未确认的保存结果须重新核对。" : "验证身份、工作区及策略读取权限。"}</p>{loss ? <button onClick={() => setCycle(v => v+1)}>重新验证访问条件</button> : null}<a href="/command">返回 Command</a></main>}</ThemeProvider>;
}
function StrategyWorkspace({route,context,runtime,denied}: {route: Location; context: RouteContext; runtime: StrategyRuntime; denied: (status: number) => void}) {
 const [,update] = useState(0),[items,setItems] = useState<StrategySummary[]>([]),[more,setMore] = useState(false),[loaded,setLoaded] = useState(false),[sort,setSort] = useState("updatedAt:desc"),[message,setMessage] = useState(""),[correlation,setCorrelation] = useState<string>(),[files,setFiles] = useState("{}"),[parameters,setParameters] = useState("{}"),[invalid,setInvalid] = useState(false),[tick,setTick] = useState(Date.now());
 const mounted = useRef(true), rawDirty = useRef(false), state = runtime.snapshot, writable = context.capabilities.includes("strategy.write"), cooling = tick < state.retryAt;
 const nav = visibleShellNavigation([...commandNavigationCapabilities(context.capabilities),"strategy:read"]).map(item => ({...item,badge:undefined}));
 useEffect(() => {mounted.current = true;const unsubscribe = runtime.subscribe(() => update(v => v+1)),timer = setInterval(() => setTick(Date.now()),500);return () => {mounted.current = false;unsubscribe();clearInterval(timer);};},[runtime]);
 async function run<T>(action: () => Promise<T>, accept?: (value: T) => void) {
  setMessage("");setCorrelation(undefined);
  try {const value = await action();runtime.assertCurrent();if (mounted.current) accept?.(value);}
  catch (e) {if (!mounted.current) return;const error = e as {status?: number;correlationId?: string};if (error.status === 401 || error.status === 403) {denied(error.status);return;}setCorrelation(error.correlationId);setMessage(error.status === 404 ? "策略不存在或当前不可见。" : error.status === 410 ? "分页已失效，请刷新目录。" : error.status === 429 ? "请求过于频繁，等待后手动保存。" : error.status === 422 ? "服务端拒绝草稿内容，请修正后保存。" : "请求未完成，请核对状态后显式重试。");}
 }
 function list(next = false) {void run(() => runtime.list({sort},next),page => {setItems(page.items);setMore(Boolean(page.nextCursor));setLoaded(true);});}
 useEffect(() => {if (route.kind === "lab") void run(() => runtime.open(route.id!),() => {const content = runtime.snapshot.local!;setFiles(pretty(content.files));setParameters(pretty(content.parameters));});else if (route.kind === "catalog") list();},[]);
 // Only a fresh valid edit or a newer edit made during a successful save arms this timer.
 useEffect(() => {if (invalid || state.status !== "dirty" || state.busy || !writable || cooling) return;const timer = setTimeout(() => {void run(() => runtime.save());},autosaveMs);return () => clearTimeout(timer);},[files,parameters,invalid,state.status,state.busy,writable,cooling]);
 useEffect(() => {const before = (event: BeforeUnloadEvent) => {if (rawDirty.current || ["dirty","saving","uncertain","conflict","error"].includes(runtime.snapshot.status)) {event.preventDefault();event.returnValue = "";}};window.addEventListener("beforeunload",before);return () => window.removeEventListener("beforeunload",before);},[runtime]);
 useEffect(() => {if (state.status === "saved" && !invalid) rawDirty.current = false;},[state.status,invalid]);
 function edit(nextFiles: string,nextParameters: string) {rawDirty.current = true;setFiles(nextFiles);setParameters(nextParameters);try {runtime.edit(nextFiles,nextParameters);setInvalid(false);setMessage("");} catch {setInvalid(true);}}
 const labels = {empty:"尚未读取草稿",saved:"已保存",dirty:"待自动保存",saving:"正在保存",conflict:"版本冲突：自动保存已暂停",uncertain:"保存结果未知：自动保存已暂停",error:"自动保存已暂停，请手动保存"};
 return <TerminalFrame className="strategy-workspace" data-route-access="authorized" mainMarker="ui301" header={<TerminalHeader workspace={`Workspace ${context.workspaceId.slice(0,8)}`} account={`Account ${context.accountId.slice(0,8)}`} initials={context.actorId.slice(0,2)} mode={context.mode} collapsed={false} onToggle={() => {}} notifications={null} readOnlyControls helpHref="#strategy-help"/>} navigation={<TerminalNavigation items={nav} activeRoute="/strategies"/>} status={<span>Strategy · 当前授权范围 · {context.mode}</span>}>
  <nav aria-label="Strategy 导航"><a href="/strategies">策略目录</a> / {route.kind === "lab" ? "Lab 草稿" : route.kind === "new" ? "创建说明" : "Strategy"}</nav><h1>{route.kind === "lab" ? "Strategy Lab" : "Strategy 目录"}</h1>
  <p role="alert">{message}{correlation ? ` 关联 ID：${correlation}` : ""}</p>
  {route.kind === "new" ? <section><h2>策略由服务端注册</h2><p>C05 当前未提供浏览器新建接口。请由策略服务负责人注册受信输入后，在目录中打开草稿。</p><a href="/strategies">浏览已注册策略</a></section> : route.kind === "catalog" ? <section aria-label="策略目录"><p>仅显示当前工作区服务端返回的策略。</p><a href="/strategies/new">新建策略说明</a><label>排序<select value={sort} onChange={e => setSort(e.target.value)}><option value="updatedAt:desc">最近更新</option><option value="updatedAt:asc">最早更新</option><option value="name:asc">名称升序</option><option value="name:desc">名称降序</option></select></label><button disabled={state.busy} onClick={() => list()}>刷新目录</button><div className="strategy-table" role="region" aria-label="策略列表" tabIndex={0}><table><caption>本页 {items.length} 项策略</caption><thead><tr><th scope="col">名称</th><th scope="col">策略 ID</th><th scope="col">更新时间</th><th scope="col">操作</th></tr></thead><tbody>{items.map(s => <tr key={s.strategyId}><th scope="row">{s.name}</th><td>{s.strategyId}</td><td><time dateTime={s.updatedAt}>{s.updatedAt}</time></td><td><a href={strategyLabPath(s.strategyId)}>打开 Lab</a></td></tr>)}</tbody></table></div>{loaded && !items.length ? <p>当前目录为空。</p> : null}<button disabled={!more || state.busy} onClick={() => list(true)}>下一页</button></section> : <section aria-label="Lab 草稿"><p>策略 ID：{route.id}</p><p role="status" aria-live="polite">{labels[state.status]} · objectVersion：{state.version ?? "—"}</p>{!writable ? <p>当前身份仅可读取草稿。</p> : null}{state.base ? <><p>数据快照：{state.base.dataSnapshotId ?? "服务端未提供"} · 更新时间：{state.base.updatedAt}</p><fieldset disabled={!writable || state.status === "uncertain"}><legend>编辑草稿</legend><label>文件 JSON<textarea aria-label="文件 JSON" spellCheck={false} value={files} aria-invalid={invalid} onChange={e => edit(e.target.value,parameters)}/></label><label>参数 JSON<textarea aria-label="参数 JSON" spellCheck={false} value={parameters} aria-invalid={invalid} onChange={e => edit(files,e.target.value)}/></label></fieldset>{invalid ? <p role="alert">内容须为有效 JSON 对象，文件值须为字符串，请求大小不得超过 32768 UTF-8 字节。无效内容不会自动保存。</p> : null}<button disabled={!writable || state.busy || invalid || state.status === "conflict" || state.status === "saved" || cooling} onClick={() => {void run(() => runtime.save());}}>{state.status === "uncertain" ? "以原请求重试保存" : "保存草稿"}</button>{cooling ? <p>请等待 {Math.ceil((state.retryAt-tick)/1000)} 秒后手动重试。</p> : null}{state.status === "uncertain" ? <p>本次结果未知，编辑已锁定。显式重试会复用原内容、版本与幂等键；离开后请重新核对服务端版本。</p> : null}
  {state.status === "conflict" ? <section aria-label="草稿冲突 diff"><h2>409 版本冲突</h2><p>本地内容与基础版本 {state.version} 已保留，尚未覆盖服务端。当前服务端版本：{state.head?.objectVersion ?? "读取失败，请刷新"}。</p><button disabled={state.busy} onClick={() => {void run(() => runtime.refreshConflict());}}>刷新冲突版本</button>{state.head ? <><div className="strategy-table" role="region" aria-label="逐字段差异" tabIndex={0}><table><caption>基础 / 本地 / 服务端差异</caption><thead><tr><th scope="col">字段</th><th scope="col">基础</th><th scope="col">本地编辑</th><th scope="col">服务端</th></tr></thead><tbody>{state.diff.map(d => <tr key={d.section+d.key}><th scope="row">{d.section}.{d.key}</th><td><pre>{pretty(d.base)}</pre></td><td><pre>{pretty(d.local)}</pre></td><td><pre>{pretty(d.server)}</pre></td></tr>)}</tbody></table></div><details><summary>完整服务端内容</summary><pre>{pretty({files:state.head.files,parameters:state.head.parameters})}</pre></details><p>请将需要保留的服务端改动合并到上方编辑器，再确认合并，最后手动保存。服务端再次变化仍返回 409。</p><button disabled={!writable || state.busy || invalid} onClick={() => {try {runtime.merge(parseDraftContent(files,parameters));setMessage("已确认合并，尚未写入。请手动保存草稿。");} catch {setMessage("合并无效，请核对内容。");}}}>确认使用当前编辑合并</button></> : null}</section> : null}</> : <button disabled={state.busy} onClick={() => {void run(() => runtime.open(route.id!),() => {const content = runtime.snapshot.local!;setFiles(pretty(content.files));setParameters(pretty(content.parameters));});}}>重新读取草稿</button>}</section>}
  <details id="strategy-help"><summary>保存与恢复说明</summary><p>有效编辑停止 1 秒后按 objectVersion 自动保存；409 不覆盖服务端，错误和结果未知均暂停自动保存。草稿仅存于当前页面内存，权限失效、切换工作区或离开页面会清除。恢复须显式读取，不会重放保存。静态检查、回测及 Release 由后续任务实现。</p></details>
 </TerminalFrame>;
}
