"use client";

import { useCallback, useEffect, useState } from "react";
import { ThemeProvider } from "@sumalpha/ui";
import { loadGuardedCommand, type GuardedCommandResult } from "../../src/command/runtime";
import { createConfiguredCommandSource } from "../../src/command/source";
import { CommandCenter } from "./ui101-command-center";

export function CommandRoute() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => { const media = matchMedia("(prefers-color-scheme: light)"); const sync = () => setTheme(media.matches ? "light" : "dark"); sync(); media.addEventListener("change", sync); return () => media.removeEventListener("change", sync); }, []);
  const [generation, setGeneration] = useState(0);
  const [result, setResult] = useState<GuardedCommandResult>();
  const refresh = useCallback(() => { setResult(undefined); setGeneration(value => value + 1); }, []);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    const source = createConfiguredCommandSource(process.env.NEXT_PUBLIC_QUANTOS_MOCK_ENABLED === "true", process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN, fetch, controller.signal);
    void loadGuardedCommand(source).then((next) => {
      if (!active) return;
      setResult(next);
      if (!next.decision.allowed && next.decision.destination) window.location.replace(next.decision.destination);
    });
    return () => { active = false; controller.abort(); };
  }, [generation]);
  useEffect(() => {
    if (!result?.projection) return;
    const p = result.projection, expiresAt = Math.min(Date.parse(p.session.expiresAt), p.summary ? Date.parse(p.summary.expiresAt) : Infinity);
    const timer = window.setTimeout(refresh, Math.max(0, Math.min(expiresAt - Date.now(), 2_147_483_647)));
    return () => window.clearTimeout(timer);
  }, [result, refresh]);
  if (!result) return <ThemeProvider theme={theme}><main className="command-guard-screen" data-guard-state="checking" aria-busy="true"><span aria-hidden="true">◌</span><h1>正在验证访问条件</h1><p>按 session → workspace → capability → resource → mode → data 顺序安全检查。</p></main></ThemeProvider>;
  if (!result.decision.allowed || !result.projection) return <ThemeProvider theme={theme}><main className="command-guard-screen" data-guard-state="denied" role="alert"><span aria-hidden="true">⊘</span><h1>访问已安全阻断</h1><p>停止于 {result.decision.stoppedAt}；未展示后续 Command 数据，正在转到安全页面。</p></main></ThemeProvider>;
  return <ThemeProvider theme={theme}><div data-guard-state="allowed" data-guard-steps={result.decision.completedSteps.join(",")}><CommandCenter projection={result.projection} contractMode={result.contractMode} onRefresh={refresh} /></div></ThemeProvider>;
}
