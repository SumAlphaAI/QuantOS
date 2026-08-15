export function renderBadge(label: string): string {
  return `[${label}]`;
}

export { designTokens } from "./tokens/index";
export type { ThemeName } from "./tokens/index";
export { StateBadge } from "./components/StateBadge/StateBadge";
export type { StateBadgeProps } from "./components/StateBadge/StateBadge";
export { Button } from "./components/Button/Button";
export type { ButtonProps } from "./components/Button/Button";
export { InlineAlert } from "./components/InlineAlert/InlineAlert";
export type { InlineAlertProps } from "./components/InlineAlert/InlineAlert";
export { DataGrid } from "./components/DataGrid/DataGrid";
export { buildDataGridSearchParams } from "./components/DataGrid/DataGrid";
export type { ComponentState, DataGridColumn, DataGridFilter, DataGridProps, DataGridUrlSync, SortDirection } from "./components/DataGrid/DataGrid";
export { EvidenceTimeline } from "./components/EvidenceTimeline/EvidenceTimeline";
export type { EvidenceEvent, EvidenceTimelineProps } from "./components/EvidenceTimeline/EvidenceTimeline";
export { DangerConfirmDialog, isDangerConfirmationValid } from "./components/DangerConfirmDialog/DangerConfirmDialog";
export type { DangerConfirmDialogProps } from "./components/DangerConfirmDialog/DangerConfirmDialog";
export { ThemeProvider, createThemeVariables, useTheme } from "./theme/ThemeProvider";
export type { ThemeContextValue, ThemeProviderProps } from "./theme/ThemeProvider";
export { I18nProvider, translate, useI18n } from "./i18n/I18nProvider";
export type { I18nProviderProps, Locale, TranslationKey } from "./i18n/I18nProvider";
