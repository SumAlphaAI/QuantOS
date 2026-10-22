import type { BffRequestOptions } from "@sumalpha/api-client";
import { completeRecentAuth, completeSecurityMfa } from "../auth/bff";
import { handleAuthHttpStatus } from "../auth/flow";
import { canRevokeDevice, canRevokeSession, type DownloadRecord, type NotificationPreferences, type ProfileSettings } from "./c17";
import { ui104SettingsFixture } from "./fixture";
import { loadSettingsSnapshot, notificationInput, profileInput, notificationDraftInput, profileDraftInput, revokeMfaFactor, revokeSettingsSession, revokeTrustedDevice, saveNotificationSettings, saveProfileSettings, SettingsGatewayError, type SettingsSnapshot, type SettingsSection } from "./gateway";
import { listBrowserDownloads, requestBrowserDownload } from "./platform";
export type SecurityTarget = "session" | "device" | "factor";
export interface SettingsRuntimeOptions { mock: boolean; origin?: string; section?: SettingsSection; fetchImpl?: typeof fetch; runtime: () => { online: boolean; width: number; csrf: string }; timeoutMs?: number; authorize?: () => void }
const mockContext = () => ({ actorId: "11111111-1111-4111-8111-111111111111", tenantId: "22222222-2222-4222-8222-222222222222", workspaceId: "33333333-3333-4333-8333-333333333333", accountId: "44444444-4444-4444-8444-444444444444", mode: "paper" as const, environment: "dev" as const, capabilities: ["settings.read", "settings.write", "audit:read"], mfaState: "verified" as const, expiresAt: "2099-01-01T00:00:00Z" });
export function createSettingsRuntime(config: SettingsRuntimeOptions) {
  const transport = config.fetchImpl ?? fetch, lifetime = new AbortController();
  const options: BffRequestOptions = { timeoutMs: config.timeoutMs ?? 15_000, signal: lifetime.signal };
  let snapshot: SettingsSnapshot | undefined, loaded = false, generation = 0, busy = false, retryAt = 0;
  const seenCursors = new Set<string>();
  const demo = structuredClone(ui104SettingsFixture), keys = new Map<string, string>(), accepted = new Map<string, { status: "accepted"; jobId: string }>();
  function fail(status: number, message = "请求未完成，请重新验证后重试。"): never { if (status === 401) handleAuthHttpStatus(401); throw new SettingsGatewayError(message, "settingsRuntime", undefined, status); }
  function guard(write = false, highRisk = false) {
    config.authorize?.();
    if (lifetime.signal.aborted || !loaded || !snapshot) fail(403);
    if (Date.parse(snapshot.context.expiresAt) <= Date.now()) fail(401);
    if (write && retryAt > Date.now()) throw new SettingsGatewayError("请求过于频繁，请等待后重试。", "settingsRuntime", undefined, 429, "RATE_LIMITED", undefined, Math.ceil((retryAt - Date.now()) / 1000));
    const runtime = config.runtime();
    if (!runtime.online || (highRisk && runtime.width < 768)) fail(403);
    if (!snapshot.context.capabilities.includes(write ? "settings.write" : "settings.read")) fail(403);
    if (write && !config.mock && !runtime.csrf) fail(403);
    return { ...runtime, context: snapshot.context };
  }
  function identity(kind: string, value: unknown) { const c = guard(true).context; return JSON.stringify([c.actorId, c.tenantId, c.workspaceId, c.accountId, c.mode, kind, value]); }
  function keyFor(intent: string) { if (!keys.has(intent)) keys.set(intent, crypto.randomUUID()); return keys.get(intent)!; }
  async function exclusive<T>(run: () => Promise<T>): Promise<T> { if (busy) throw Error("已有请求处理中"); busy = true; try { return await run(); } catch (reason) {
      const error = reason as { status?: number; retryAfter?: number };
      if (error.status === 429 && retryAt <= Date.now()) retryAt = Date.now() + (Number.isFinite(error.retryAfter) && error.retryAfter! > 0 ? error.retryAfter! : 30) * 1000;
      throw reason;
    } finally { busy = false; } }
  async function freshForDraft() {
    const previous = guard().context, epoch = generation;
    const fresh = config.mock ? { context: mockContext(), loadedAt: new Date().toISOString(), bundle: { ...structuredClone(demo), downloadsNextCursor: demo.downloadsNextCursor } } : await loadSettingsSnapshot(config.origin!, transport, options, config.section);
    if (["actorId", "tenantId", "workspaceId", "accountId", "mode"].some(key => fresh.context[key as keyof typeof previous] !== previous[key as keyof typeof previous])) fail(403);
    guard(); if (epoch !== generation) fail(403); snapshot = fresh; return fresh;
  }
  return {
    async load(signal?: AbortSignal): Promise<SettingsSnapshot> {
      const epoch = ++generation; loaded = false; seenCursors.clear();
      const result = config.mock ? { context: mockContext(), loadedAt: new Date().toISOString(), bundle: { ...structuredClone(demo), downloadsNextCursor: demo.downloadsNextCursor } } : !config.origin ? fail(503, "设置服务未配置。") : await loadSettingsSnapshot(config.origin, transport, { ...options, signal: AbortSignal.any([lifetime.signal, ...(signal ? [signal] : [])]) }, config.section);
      if (epoch !== generation || signal?.aborted || lifetime.signal.aborted) throw Error("Settings load cancelled");
      snapshot = result; loaded = true; return structuredClone(result);
    },
    close() { loaded = false; snapshot = undefined; generation++; lifetime.abort(); keys.clear(); accepted.clear(); },
    saveProfile(draft: ProfileSettings) { return exclusive(async () => {
      const epoch = generation, input = profileInput(draft), intent = identity("profile", [draft.objectVersion, input]); guard(true);
      let saved: ProfileSettings;
      if (config.mock) { if (draft.objectVersion !== demo.profile.objectVersion) fail(409, "版本冲突，草稿已保留。"); saved = { ...demo.profile, ...input, objectVersion: crypto.randomUUID() }; demo.profile = saved; }
      else saved = await saveProfileSettings(config.origin!, input, draft.objectVersion, keyFor(intent), config.runtime().csrf, transport, options);
      guard(true); if (epoch !== generation) fail(403); if (saved.memberId !== snapshot!.bundle.profile.memberId) fail(403); keys.delete(intent); return saved;
    }); },
    saveNotifications(draft: NotificationPreferences) { return exclusive(async () => {
      const epoch = generation, input = notificationInput(draft), intent = identity("notifications", [draft.objectVersion, input]); guard(true);
      let saved: NotificationPreferences;
      if (config.mock) { if (draft.objectVersion !== demo.notifications.objectVersion) fail(409, "版本冲突，草稿已保留。"); saved = { ...demo.notifications, ...input, objectVersion: crypto.randomUUID() }; demo.notifications = saved; }
      else saved = await saveNotificationSettings(config.origin!, input, draft.objectVersion, keyFor(intent), config.runtime().csrf, transport, options);
      guard(true); if (epoch !== generation) fail(403); keys.delete(intent); return saved;
    }); },
    async refreshProfile(draft: ProfileSettings) { const latest = (await freshForDraft()).bundle.profile; return { ...latest, ...profileDraftInput(draft) }; },
    async refreshNotifications(draft: NotificationPreferences) { const latest = (await freshForDraft()).bundle.notifications; if (!latest) fail(403); return { ...latest, ...notificationDraftInput(draft) }; },
    reauthenticate(code: string) { return exclusive(async () => {
      const epoch = generation; guard(true, true); if (!/^\d{6}$/.test(code)) fail(422);
      if (config.mock) return { expiresAt: new Date(Date.now() + 30000).toISOString() };
      const challenge = await completeSecurityMfa(config.origin!, code, config.runtime().csrf, transport, options);
      guard(true, true); if (epoch !== generation) fail(403); if (challenge.status !== "verified") fail(422);
      const grant = await completeRecentAuth(config.origin!, challenge.challengeRef, config.runtime().csrf, transport, options);
      guard(true, true); if (epoch !== generation || Date.parse(grant.expiresAt) <= Date.now()) fail(403);
      return { expiresAt: grant.expiresAt };
    }); },
    revoke(kind: SecurityTarget, id: string, phrase: string, code?: string) { return exclusive(async () => {
      const epoch = generation; guard(true, true);
      if (phrase !== `REVOKE ${id}` || !/^\d{6}$/.test(code ?? "")) fail(422);
      const data = snapshot!.bundle, runtime = config.runtime();
      if (!data.security || !data.sessions || !data.devices) fail(403);
      const target = kind === "session" ? data.sessions.find(s => s.sessionId === id) : kind === "device" ? data.devices.find(d => d.deviceId === id) : data.security.factors.find(f => f.factorId === id);
      if (!target || (kind === "session" && !canRevokeSession(target as typeof data.sessions[number], { online: runtime.online, viewportWidth: runtime.width })) || (kind === "device" && ((target as typeof data.devices[number]).current || !canRevokeDevice({ online: runtime.online, viewportWidth: runtime.width, factorCount: data.security.factors.length }))) || (kind === "factor" && (data.security.factors.length <= 1 || (target as typeof data.security.factors[number]).currentDevice))) fail(403);
      const intent = identity(kind, id);
      if (accepted.has(intent)) return accepted.get(intent)!;
      let result: { status: "accepted"; jobId: string };
      if (config.mock) {
        result = { status: "accepted", jobId: crypto.randomUUID() };
        if (kind === "session") demo.sessions = demo.sessions.filter(s => s.sessionId !== id);
        if (kind === "device") demo.devices = demo.devices.filter(d => d.deviceId !== id);
        if (kind === "factor") demo.security.factors = demo.security.factors.filter(f => f.factorId !== id);
      } else {
        const challenge = await completeSecurityMfa(config.origin!, code!, config.runtime().csrf, transport, options);
        guard(true, true); if (epoch !== generation) fail(403); if (challenge.status !== "verified") fail(422);
        const grant = await completeRecentAuth(config.origin!, challenge.challengeRef, config.runtime().csrf, transport, options);
        guard(true, true); if (epoch !== generation || Date.parse(grant.expiresAt) <= Date.now()) fail(403);
        const revoke = kind === "session" ? revokeSettingsSession : kind === "device" ? revokeTrustedDevice : revokeMfaFactor;
        const response = await revoke(config.origin!, id, grant.reauthTokenRef, keyFor(intent), config.runtime().csrf, transport, options);
        if (response.status !== "accepted") throw Error("Security request not accepted");
        result = { status: response.status, jobId: response.jobId };
      }
      guard(true, true); if (epoch !== generation) fail(403); accepted.set(intent, result); return result;
    }); },
    moreDownloads(cursor: string) { return exclusive(async () => {
      guard(); const epoch = generation, current = snapshot!.bundle;
      if (config.mock || !cursor || cursor !== current.downloadsNextCursor || seenCursors.has(cursor) || !current.downloads) fail(403);
      if (current.downloads.length >= 500 || seenCursors.size >= 4) throw Error("Download history limit reached");
      const page = await listBrowserDownloads(config.origin!, {cursor, pageSize: 100}, transport, options);
      guard(); if (generation !== epoch) fail(403);
      const ids = new Set(current.downloads.map(row => row.downloadId));
      if (page.items.length > 100 || current.downloads.length + page.items.length > 500 || page.items.some(row => { if (ids.has(row.downloadId)) return true; ids.add(row.downloadId); return false; }) || (page.nextCursor && (page.nextCursor === cursor || seenCursors.has(page.nextCursor)))) throw Error("Invalid download pagination");
      seenCursors.add(cursor); current.downloads.push(...page.items); current.downloadsNextCursor = page.nextCursor;
      const limitReached = Boolean(page.nextCursor) && (current.downloads.length >= 500 || seenCursors.size >= 4);
      return structuredClone({items: current.downloads, nextCursor: limitReached ? undefined : page.nextCursor, limitReached});
    }); },
    download(record: DownloadRecord) { return exclusive(async () => {
      guard(); const epoch = generation;
      if (!snapshot!.bundle.browserPolicy?.downloadsViaBff) fail(403);
      const source = snapshot!.bundle.downloads?.find(row => row.downloadId === record.downloadId);
      if (!source || JSON.stringify(source) !== JSON.stringify(record)) fail(403);
      if (config.mock) throw Error("本地演示不签发下载链接。");
      const lease = await requestBrowserDownload(config.origin!, source, Date.now, transport, options);
      guard(); if (generation !== epoch || Date.parse(lease.expiresAt) <= Date.now()) fail(403);
      return lease;
    }); },
  };
}
export type SettingsActions = ReturnType<typeof createSettingsRuntime>;
