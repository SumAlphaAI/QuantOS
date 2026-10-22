"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ThemeProvider } from "@sumalpha/ui";
import { loadGuardedCommand, type GuardedCommandResult } from "../../src/command/runtime";
import { createConfiguredCommandSource } from "../../src/command/source";
import {browserAccessEnvironment, createRouteAccess, type AccessLoss} from "../../src/auth/route-access";
import {handleAuthHttpStatus, sessionStore} from "../../src/auth/flow";
import { CommandCenter } from "./ui101-command-center";

export function CommandRoute() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => { const media = matchMedia("(prefers-color-scheme: light)"); const sync = () => setTheme(media.matches ? "light" : "dark"); sync(); media.addEventListener("change", sync); return () => media.removeEventListener("change", sync); }, []);
  const [generation, setGeneration] = useState(0), [result, setResult] = useState<GuardedCommandResult>(), [loss, setLoss] = useState<AccessLoss>();
  const stop = useRef<() => void>(() => {});
  const refresh = useCallback(() => {stop.current();setResult(undefined);setLoss(undefined);setGeneration(value => value + 1);}, []);
  useEffect(() => {
    let active = true;const cancel = new AbortController();
    const access = createRouteAccess({mock: process.env.NEXT_PUBLIC_QUANTOS_MOCK_ENABLED === "true", origin: process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN, environment: browserAccessEnvironment(), onInvalidate(next) {
      active = false;cancel.abort();setResult(undefined);setLoss(next);
      if (next.status === 401 || next.reason === "revoked") sessionStore.clear();
      if (next.status === 401 || next.status === 403 || next.status === 404) {const decision = handleAuthHttpStatus(next.status, "/command");if ("route" in decision) window.location.replace(decision.route);}
    }});
    const cleanup = () => {active = false;cancel.abort();access.close();};stop.current = cleanup;
    if (!navigator.onLine || document.hidden) {access.invalidate({reason: !navigator.onLine ? "offline" : "hidden"});return cleanup;}
    const source = createConfiguredCommandSource(process.env.NEXT_PUBLIC_QUANTOS_MOCK_ENABLED === "true", process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN, fetch, cancel.signal);
    void loadGuardedCommand(source).then(async next => {
      if (!active) return;
      if (next.decision.allowed && next.projection) {
        const p = next.projection;
        await access.bind(p.session, Math.min(Date.parse(p.session.expiresAt), p.summary ? Date.parse(p.summary.expiresAt) : Infinity));
        access.assertCurrent();if (!active) return;
      }
      setResult(next);
      if (!next.decision.allowed && next.decision.destination) window.location.replace(next.decision.destination);
    }).catch(() => {if (active) access.invalidate({reason: "unavailable"});});
    return cleanup;
  }, [generation]);
  if (loss) return <ThemeProvider theme={theme}><main className="command-guard-screen" data-route-access="invalidated" data-access-loss={loss.reason} role="alert"><h1>访问条件已变化</h1><p>已停止显示 Command 数据。恢复连接后请重新验证，操作不会自动重放。</p><button onClick={refresh}>重新验证访问条件</button></main></ThemeProvider>;
  if (!result) return <ThemeProvider theme={theme}><main className="command-guard-screen" data-route-access="checking" data-guard-state="checking" aria-busy="true"><span aria-hidden="true">◌</span><h1>正在验证访问条件</h1><p>按 session → workspace → capability → resource → mode → data 顺序安全检查。</p></main></ThemeProvider>;
  if (!result.decision.allowed || !result.projection) return <ThemeProvider theme={theme}><main className="command-guard-screen" data-guard-state="denied" role="alert"><span aria-hidden="true">⊘</span><h1>访问已安全阻断</h1><p>停止于 {result.decision.stoppedAt}；未展示后续 Command 数据，正在转到安全页面。</p></main></ThemeProvider>;
  return <ThemeProvider theme={theme}><div data-route-access="authorized" data-guard-state="allowed" data-guard-steps={result.decision.completedSteps.join(",")}><CommandCenter projection={result.projection} contractMode={result.contractMode} onRefresh={refresh} /></div></ThemeProvider>;
}
