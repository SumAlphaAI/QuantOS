import { commandLayoutKey } from "../command/presentation";
export const presentationStorageKeys = [commandLayoutKey] as const;
export type StorageProbe = {status: "available" | "unknown" | "unsupported"; usage?: number; quota?: number};
// Estimate origin-wide bytes only. Never enumerate storage or inspect cookies/tokens.
export async function estimateBrowserStorage(storage?: Pick<StorageManager, "estimate">, timeoutMs = 2000): Promise<StorageProbe> {
  if (typeof storage?.estimate !== "function") return {status: "unsupported"};
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([storage.estimate(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("estimate timeout")), timeoutMs); })]);
    if (!Number.isFinite(result.usage) || !Number.isFinite(result.quota) || result.usage! < 0 || result.quota! <= 0 || result.usage! > result.quota!) return {status: "unknown"};
    return {status: "available", usage: result.usage, quota: result.quota};
  } catch { return {status: "unknown"}; } finally { clearTimeout(timer); }
}
export function clearPresentationStorage(storage: Pick<Storage, "removeItem" | "getItem">, phrase: string) {
  if (phrase !== "CLEAR LOCAL LAYOUT") throw Error("Confirmation required");
  for (const key of presentationStorageKeys) { storage.removeItem(key); if (storage.getItem(key) !== null) throw Error("Layout cleanup unconfirmed"); }
}
export function browserDeepLink(origin: string) {
  const url = new URL("/auth/deep-link", origin);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("Invalid browser origin");
  url.searchParams.set("return_to", "/settings/browser"); return url.href;
}
export function storageBytes(value: number) { return `${(value / 1048576).toFixed(1)} MiB`; }
