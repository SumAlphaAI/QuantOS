import type { CSSProperties } from "react";
import tokens from "../../tokens/index";
import { useOptionalTheme } from "../../theme/ThemeProvider";
import { translate, useOptionalI18n, type TranslationKey } from "../../i18n/I18nProvider";

/** Frozen state labels with safe unknown fallback; action guards remain the caller's responsibility. */
export type StateDomain = keyof typeof tokens.stateColor;
const ICONS: Record<string, string> = {
  "semantic.success": "●", "semantic.warning": "▲", "semantic.danger": "■",
  "semantic.info": "◆", "text.secondary": "○",
};
export interface StateBadgeProps {
  state: string;
  /** Optional translated display label for known states. Unknown states always use state.unknown. */
  label?: string;
  locale?: "en" | "zh-CN";
  theme?: "dark" | "light";
}
export function StateBadge({ state, label, locale, theme }: StateBadgeProps) {
  const themeContext = useOptionalTheme();
  const i18nContext = useOptionalI18n();
  const activeTheme = theme ?? themeContext?.theme ?? "dark";
  const activeLocale = locale ?? i18nContext?.locale ?? "zh-CN";
  const candidate = typeof state === "string" && Object.hasOwn(tokens.stateColor, state)
    ? (tokens.stateColor as Record<string, unknown>)[state] : undefined;
  const known = typeof candidate === "string" && Object.hasOwn(ICONS, candidate);
  const tokenPath = known ? candidate : "semantic.warning";
  const [group, key] = tokenPath.split(".");
  const palette = tokens.color[activeTheme] as unknown as Record<string, Record<string, string>>;
  const color = palette[group]?.[key] ?? tokens.color[activeTheme].semantic.warning;
  const text = known && label ? label : translate(activeLocale, (known ? `state.${state}` : "state.unknown") as TranslationKey);
  return (
    <span role="status" aria-label={text} style={{
      display: "inline-flex", alignItems: "center", gap: tokens.spacing.base, color,
      fontSize: tokens.typography.table.fontSize, lineHeight: tokens.typography.table.lineHeight,
      fontVariantNumeric: tokens.typography.numeric.fontVariantNumeric as CSSProperties["fontVariantNumeric"],
    }}>
      <span aria-hidden="true">{ICONS[tokenPath]}</span><span>{text}</span>
    </span>
  );
}
export default StateBadge;
