"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ThemeProvider } from "@sumalpha/ui";
import { settingsCsrf } from "../../../src/settings/presentation";
import { createSettingsRuntime } from "../../../src/settings/runtime";
import type { SettingsSnapshot } from "../../../src/settings/gateway";
import { SettingsWorkspace, type SettingsSection } from "./ui104-settings-workspace";
export function SettingsRoute({ section }: { section: SettingsSection }) {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot>(); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [generation, setGeneration] = useState(0);
  const current = useRef<SettingsSnapshot>(undefined), actions = useRef<ReturnType<typeof createSettingsRuntime>>(undefined);
  const onError = useCallback((reason: unknown) => {
    const status = (reason as { status?: number })?.status;
    if (status === 401 || status === 403 || status === 404) { current.current = undefined; setSnapshot(undefined); window.location.replace(status === 401 ? "/login?return_to=" + encodeURIComponent(`/settings/${section}`) : "/unauthorized"); }
  }, [section]);
  useEffect(() => {
    const controller = createSettingsRuntime({ section, mock: process.env.NEXT_PUBLIC_QUANTOS_MOCK_ENABLED === "true", origin: process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN, runtime: () => ({ online: navigator.onLine, width: window.innerWidth, csrf: settingsCsrf(document.cookie) }) });
    actions.current = controller; setGeneration(value => value + 1);
    return () => { controller.close(); actions.current = undefined; current.current = undefined; };
  }, [section]);
  useEffect(() => {
    const controller = actions.current; if (!controller || generation === 0) return; let active = true; const cancel = new AbortController();
    setLoading(true); setError(false);
    void controller.load(cancel.signal).then(next => {
      if (!active) return;
      const old = current.current?.context;
      if (old && ["actorId", "tenantId", "workspaceId", "accountId", "mode"].some(key => old[key as keyof typeof old] !== next.context[key as keyof typeof old])) { onError({ status: 403 }); return; }
      current.current = next; setSnapshot(next); setLoading(false);
    }).catch(reason => { if (active) { onError(reason); setLoading(false); setError(true); if (!current.current) setSnapshot(undefined); } });
    return () => { active = false; cancel.abort(); };
  }, [generation, onError]);
  useEffect(() => {
    if (!snapshot) return;
    const timer = window.setTimeout(() => { current.current = undefined; setSnapshot(undefined); setGeneration(value => value + 1); }, Math.max(0, Math.min(Date.parse(snapshot.context.expiresAt) - Date.now(), 2_147_483_647)));
    return () => window.clearTimeout(timer);
  }, [snapshot]);
  if (!snapshot) return <ThemeProvider theme="dark"><main className="command-guard-screen" data-settings-guard={error ? "error" : "checking"} aria-busy={loading}><h1>{error ? "设置暂不可用" : "正在验证设置访问条件"}</h1><p>{error ? "请求未完成，未展示任何个人资料。" : "正在验证会话与主工作区权限。"}</p>{error ? <button onClick={() => setGeneration(value => value + 1)}>重试读取设置</button> : null}</main></ThemeProvider>;
  return <SettingsWorkspace section={section} initialData={snapshot.bundle} context={snapshot.context} loadedAt={snapshot.loadedAt} actions={actions.current} onError={onError} onReload={() => setGeneration(value => value + 1)} contractMode={process.env.NEXT_PUBLIC_QUANTOS_MOCK_ENABLED === "true" ? "mocked" : "integrated"} pageState={loading || error ? "stale" : "default"} />;
}
