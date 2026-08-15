"use client";

import { useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "@sumalpha/ui";

import { createCommandFixtureSource, loadGuardedCommand, type GuardedCommandResult } from "../../src/command/runtime";
import { CommandCenter } from "./ui101-command-center";

export function CommandRoute() {
  const source = useMemo(() => createCommandFixtureSource(), []);
  const [result, setResult] = useState<GuardedCommandResult>();

  useEffect(() => {
    let active = true;
    void loadGuardedCommand(source).then((next) => {
      if (!active) return;
      setResult(next);
      if (!next.decision.allowed && next.decision.destination) window.location.replace(next.decision.destination);
    });
    return () => { active = false; };
  }, [source]);

  if (!result) return <ThemeProvider theme="dark"><main className="command-guard-screen" data-guard-state="checking" aria-busy="true"><span aria-hidden="true">◌</span><h1>正在验证访问条件</h1><p>按 session → workspace → capability → resource → mode → data 顺序安全检查。</p></main></ThemeProvider>;
  if (!result.decision.allowed || !result.projection) return <ThemeProvider theme="dark"><main className="command-guard-screen" data-guard-state="denied" role="alert"><span aria-hidden="true">⊘</span><h1>访问已安全阻断</h1><p>停止于 {result.decision.stoppedAt}；未加载任何后续 Command 数据，正在转到安全页面。</p></main></ThemeProvider>;
  return <ThemeProvider theme="dark"><div data-guard-state="allowed" data-guard-steps={result.decision.completedSteps.join(",")}><CommandCenter projection={result.projection} contractMode={result.contractMode} /></div></ThemeProvider>;
}
