"use client";

import { createContext, useContext, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import designTokens, { type ThemeName } from "../tokens/index";
type ThemeVariables = CSSProperties & Record<`--q-${string}`, string>;
export interface ThemeContextValue { theme: ThemeName; setTheme: (theme: ThemeName) => void }
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function createThemeVariables(theme: ThemeName): ThemeVariables {
  const color = designTokens.color[theme]; const spacing = designTokens.spacing.scale;
  return {
    "--q-color-scheme": theme, "--q-surface-0": color.surface["0"], "--q-surface-1": color.surface["1"], "--q-surface-2": color.surface["2"],
    "--q-border": color.border.default, "--q-border-strong": color.border.strong, "--q-text-primary": color.text.primary, "--q-text-secondary": color.text.secondary, "--q-text-disabled": color.text.disabled,
    "--q-brand": color.brand.bg, "--q-brand-hover": color.brand.bgHover, "--q-brand-fg": color.brand.fg, "--q-success": color.semantic.success, "--q-warning": color.semantic.warning, "--q-danger": color.semantic.danger, "--q-info": color.semantic.info,
    "--q-focus": color.semantic.info, "--q-focus-width": `${designTokens.focus.ringWidth}px`, "--q-font-sans": designTokens.typography.fontFamily.sans, "--q-font-mono": designTokens.typography.fontFamily.mono,
    "--q-font-body-size": designTokens.typography.body.fontSize, "--q-font-body-line": designTokens.typography.body.lineHeight, "--q-font-table-size": designTokens.typography.table.fontSize, "--q-font-table-line": designTokens.typography.table.lineHeight,
    "--q-font-page-size": designTokens.typography.pageTitle.fontSize, "--q-font-page-line": designTokens.typography.pageTitle.lineHeight, "--q-space-1": `${spacing[1]}px`, "--q-space-2": `${spacing[2]}px`, "--q-space-3": `${spacing[3]}px`, "--q-space-4": `${spacing[4]}px`, "--q-space-5": `${spacing[5]}px`,
    "--q-radius-sm": `${designTokens.radius.sm}px`, "--q-radius-md": `${designTokens.radius.md}px`, "--q-radius-lg": `${designTokens.radius.lg}px`, "--q-control-height": `${designTokens.density.compact.controlHeight}px`, "--q-row-height": `${designTokens.density.compact.rowHeight}px`,
  };
}
export interface ThemeProviderProps { children: ReactNode; defaultTheme?: ThemeName; theme?: ThemeName; onThemeChange?: (theme: ThemeName) => void; className?: string }
export function ThemeProvider({ children, defaultTheme = "dark", theme: controlledTheme, onThemeChange, className }: ThemeProviderProps) {
  const [internalTheme, setInternalTheme] = useState(defaultTheme); const theme = controlledTheme ?? internalTheme;
  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme(next) { if (controlledTheme === undefined) setInternalTheme(next); onThemeChange?.(next); } }), [controlledTheme, onThemeChange, theme]);
  return <ThemeContext.Provider value={value}><div className={`quantos-theme${className ? ` ${className}` : ""}`} data-quantos-theme={theme} style={createThemeVariables(theme)}>{children}</div></ThemeContext.Provider>;
}
export function useTheme(): ThemeContextValue { const context = useContext(ThemeContext); if (!context) throw new Error("useTheme must be used inside ThemeProvider"); return context; }
