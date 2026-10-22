"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ThemeProvider } from "@sumalpha/ui";
import { settingsCsrf } from "../../../src/settings/presentation";
import { createSettingsRuntime } from "../../../src/settings/runtime";
import type { SettingsSnapshot } from "../../../src/settings/gateway";
import {browserAccessEnvironment, createRouteAccess, type AccessLoss} from "../../../src/auth/route-access";
import {handleAuthHttpStatus, sessionStore} from "../../../src/auth/flow";
import { SettingsWorkspace, type SettingsSection } from "./ui104-settings-workspace";
export function SettingsRoute({ section }: { section: SettingsSection }) {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot>(), [loading, setLoading] = useState(true), [loss, setLoss] = useState<AccessLoss>();
  const [cycle, setCycle] = useState(0), [generation, setGeneration] = useState(0);
  const actions = useRef<ReturnType<typeof createSettingsRuntime>>(undefined), monitor = useRef<ReturnType<typeof createRouteAccess>>(undefined), stop = useRef<() => void>(() => {});
  useEffect(() => {
    let mounted = true;
    const access = createRouteAccess({mock: process.env.NEXT_PUBLIC_QUANTOS_MOCK_ENABLED === "true", origin: process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN, environment: browserAccessEnvironment(), onInvalidate(next) {
      controller.close();if (!mounted) return;setSnapshot(undefined);setLoading(false);setLoss(next);
      if (next.status === 401 || next.reason === "revoked") sessionStore.clear();
      if (next.status === 401 || next.status === 403 || next.status === 404) {const decision = handleAuthHttpStatus(next.status, `/settings/${section}`);if ("route" in decision) window.location.replace(decision.route);}
    }});
    const controller = createSettingsRuntime({section, mock: process.env.NEXT_PUBLIC_QUANTOS_MOCK_ENABLED === "true", origin: process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN, authorize: access.assertCurrent, runtime: () => ({online: navigator.onLine, width: window.innerWidth, csrf: settingsCsrf(document.cookie)})});
    actions.current = controller;monitor.current = access;setSnapshot(undefined);setLoss(undefined);setLoading(true);
    const cleanup = () => {mounted = false;controller.close();access.close();if (actions.current === controller) {actions.current = undefined;monitor.current = undefined;}};stop.current = cleanup;
    setGeneration(value => value + 1);return cleanup;
  }, [section, cycle]);
  useEffect(() => {
    const controller = actions.current, access = monitor.current;if (!controller || !access || generation === 0) return;
    let active = true;const cancel = new AbortController();setLoading(true);
    if (!navigator.onLine || document.hidden) {access.invalidate({reason: !navigator.onLine ? "offline" : "hidden"});return;}
    void controller.load(cancel.signal).then(async next => {
      if (!active || actions.current !== controller || access.closed) return;
      await access.bind(next.context);access.assertCurrent();if (!active || actions.current !== controller) return;
      setSnapshot(next);setLoading(false);
    }).catch(reason => {if (active && !access.closed && actions.current === controller) {const status = (reason as {status?: number})?.status;access.invalidate({reason: "unavailable", status});}});
    return () => {active = false;cancel.abort();};
  }, [generation]);
  const reload = useCallback(() => {
    if (monitor.current?.closed || !actions.current) {stop.current();setLoss(undefined);setSnapshot(undefined);setLoading(true);setCycle(value => value + 1);}
    else {setLoading(true);setGeneration(value => value + 1);}
  }, []);
  if (!snapshot) return <ThemeProvider theme="dark"><main className="command-guard-screen" data-route-access={loss ? "invalidated" : "checking"} data-access-loss={loss?.reason} data-settings-guard={loss ? "error" : "checking"} aria-busy={loading}><h1>{loss ? "访问条件已变化" : "正在验证设置访问条件"}</h1><p>{loss ? "已清除个人设置。恢复访问后请重新验证，未完成的操作不会自动重放。" : "正在验证会话与主工作区权限。"}</p>{loss ? <button onClick={reload}>重新验证访问条件</button> : null}</main></ThemeProvider>;
  const renderedController = actions.current;
  return <div data-route-access="authorized"><SettingsWorkspace section={section} initialData={snapshot.bundle} context={snapshot.context} loadedAt={snapshot.loadedAt} actions={renderedController} onError={reason => {
    if (actions.current !== renderedController) return;const status = (reason as {status?: number})?.status;
    if (status === 401 || status === 403 || status === 404) monitor.current?.invalidate({reason: "unavailable", status});
  }} onReload={reload} contractMode={process.env.NEXT_PUBLIC_QUANTOS_MOCK_ENABLED === "true" ? "mocked" : "integrated"} pageState={loading ? "stale" : "default"} /></div>;
}
