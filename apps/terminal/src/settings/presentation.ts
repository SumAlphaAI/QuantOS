import type { ProfileSettings } from "./c17";
/** Malformed cookies must not crash the read-only workspace or invent a CSRF token. */
export function settingsCsrf(cookie: string): string {
  try { return decodeURIComponent(cookie.match(/(?:^|; )quantos_csrf=([^;]+)/)?.[1] ?? ""); } catch { return ""; }
}
export function settingsTheme(preference: ProfileSettings["theme"], systemLight: boolean): "dark" | "light" {
  return preference === "system" ? systemLight ? "light" : "dark" : preference;
}
export const settingsInitials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join("") || "?";
/** The selected locale/zone affects date presentation, never the original server timestamp. */
export function settingsDate(value: string, preference: Pick<ProfileSettings, "locale" | "timezone" | "timeDisplay">): string {
  try {
    if (!Number.isFinite(Date.parse(value))) return "时间未提供";
    const date = new Date(value), options = { dateStyle: "short", timeStyle: "short" } as const;
    const local = new Intl.DateTimeFormat(preference.locale, { ...options, timeZone: preference.timezone }).format(date);
    const utc = preference.timeDisplay === "utc_local" && preference.timezone !== "UTC" ? ` · ${new Intl.DateTimeFormat(preference.locale, { ...options, timeZone: "UTC" }).format(date)} UTC` : "";
    return `${local} ${preference.timezone}${utc}`;
  } catch { return "日期或时区不可用"; }
}
