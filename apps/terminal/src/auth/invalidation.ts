// Invalidation hints only: never carry identity, credentials or permission grants.
export type AuthInvalidation = "session" | "context";
const channelName = "quantos.auth.invalidate.v1";
const storageKey = "quantos.auth.invalidate";
const listeners = new Set<(kind: AuthInvalidation) => void>();
let channel: BroadcastChannel | undefined, release: (() => void) | undefined;
function deliver(kind: AuthInvalidation) { for (const listener of [...listeners]) listener(kind); }
function decode(raw: unknown): AuthInvalidation | undefined {
  if (!raw || typeof raw !== "object" || Object.keys(raw).sort().join(",") !== "type,version") return;
  const r = raw as {version?: unknown; type?: unknown};
  return r.version === 1 && (r.type === "session" || r.type === "context") ? r.type : undefined;
}
export function subscribeAuthInvalidation(listener: (kind: AuthInvalidation) => void) {
  listeners.add(listener);
  if (!release && typeof window !== "undefined") {
    try { if (typeof window.BroadcastChannel === "function") {channel = new window.BroadcastChannel(channelName);channel.onmessage = event => {const kind = decode(event.data);if (kind) deliver(kind);};} } catch {channel = undefined;}
    const storage = (event: StorageEvent) => {if (event.key === storageKey && event.newValue) {try {const kind = decode(JSON.parse(event.newValue));if (kind) deliver(kind);} catch { /* no authority in malformed hints */ }}};
    window.addEventListener("storage", storage);
    release = () => {channel?.close();channel = undefined;window.removeEventListener("storage", storage);release = undefined;};
  }
  return () => {listeners.delete(listener);if (!listeners.size) release?.();};
}
export function publishAuthInvalidation(kind: AuthInvalidation) {
  const message = {version: 1, type: kind};
  // Deliver synchronously before React can process another private action.
  deliver(kind);
  if (typeof window === "undefined") return;
  try {
    const outgoing = new window.BroadcastChannel(channelName);outgoing.postMessage(message);outgoing.close();
  } catch {
    // Transient non-authoritative signal only; never persist a session or draft.
    try {window.localStorage.setItem(storageKey, JSON.stringify(message));window.localStorage.removeItem(storageKey);} catch { /* C01/SSE still gate access */ }
  }
}
