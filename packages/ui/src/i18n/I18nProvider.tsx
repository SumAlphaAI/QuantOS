"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import en from "./en.json"; import zhCN from "./zh-CN.json";
export type Locale = "en" | "zh-CN"; export type TranslationKey = keyof typeof zhCN;
const dictionaries: Record<Locale, Record<string, string>> = { en, "zh-CN": zhCN };
export function translate(locale: Locale, key: TranslationKey, values: Record<string, string | number> = {}): string { const template = dictionaries[locale][key] ?? dictionaries.en[key] ?? key; return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`)); }
interface I18nContextValue { locale: Locale; setLocale: (locale: Locale) => void; t: (key: TranslationKey, values?: Record<string, string | number>) => string }
const I18nContext = createContext<I18nContextValue | null>(null);
export interface I18nProviderProps { children: ReactNode; defaultLocale?: Locale; locale?: Locale; onLocaleChange?: (locale: Locale) => void }
export function I18nProvider({ children, defaultLocale = "zh-CN", locale: controlledLocale, onLocaleChange }: I18nProviderProps) { const [internalLocale, setInternalLocale] = useState(defaultLocale); const locale = controlledLocale ?? internalLocale; const value = useMemo<I18nContextValue>(() => ({ locale, setLocale(next) { if (controlledLocale === undefined) setInternalLocale(next); onLocaleChange?.(next); }, t: (key, values) => translate(locale, key, values) }), [controlledLocale, locale, onLocaleChange]); return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>; }
export function useI18n(): I18nContextValue { const context = useContext(I18nContext); if (!context) throw new Error("useI18n must be used inside I18nProvider"); return context; }
