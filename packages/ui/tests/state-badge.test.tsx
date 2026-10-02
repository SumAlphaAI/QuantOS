import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StateBadge, ThemeProvider, I18nProvider, translate } from "../src/index";
import tokens from "../src/tokens/index";
import type { Locale, TranslationKey } from "../src/i18n/I18nProvider";
import type { ThemeName } from "../src/tokens/index";

function render(state: string, theme: ThemeName, locale: Locale, override?: { theme?: ThemeName; locale?: Locale; label?: string }) {
  return renderToStaticMarkup(<ThemeProvider theme={theme}><I18nProvider locale={locale}><StateBadge state={state} {...override} /></I18nProvider></ThemeProvider>);
}
describe("StateBadge provider integration", () => {
  for (const theme of ["dark", "light"] as const) for (const locale of ["en", "zh-CN"] as const) {
    it(`renders every frozen state in ${theme}/${locale}`, () => {
      for (const [state, path] of Object.entries(tokens.stateColor)) {
        const [group, key] = path.split(".");
        const palette = tokens.color[theme] as unknown as Record<string, Record<string, string>>;
        const markup = render(state, theme, locale);
        expect(markup).toContain(`aria-label="${translate(locale, `state.${state}` as TranslationKey)}"`);
        expect(markup).toContain(`color:${palette[group][key]};`);
      }
    });
  }
  for (const state of ["some_future_enum", "toString", "constructor", "__proto__"]) {
    it(`fails closed visually for ${state} without throwing`, () => {
      const markup = render(state, "light", "en", { label: "Allowed" });
      expect(markup).toContain('aria-label="Unknown / upgrade required"');
      expect(markup).toContain(`color:${tokens.color.light.semantic.warning};`);
      expect(markup).not.toContain("Allowed");
    });
  }
  it("handles non-string runtime values as unknown", () => {
    for (const value of [null, undefined, 42]) expect(render(value as unknown as string, "light", "en")).toContain('aria-label="Unknown / upgrade required"');
  });
  it("keeps explicit props as deliberate overrides and supports standalone rendering", () => {
    expect(render("running", "light", "en", { theme: "dark", locale: "zh-CN" })).toContain(`color:${tokens.color.dark.semantic.info};`);
    expect(renderToStaticMarkup(<StateBadge state="deny" />)).toContain('aria-label="拒绝"');
  });
  it("follows changed typography and spacing tokens without component edits", () => {
    const previous = { ...tokens.typography.table }; const previousBase = tokens.spacing.base;
    try {
      tokens.typography.table.fontSize = "17px"; tokens.typography.table.lineHeight = "24px"; tokens.spacing.base = 8;
      const markup = renderToStaticMarkup(<StateBadge state="running" />);
      expect(markup).toContain("font-size:17px"); expect(markup).toContain("line-height:24px"); expect(markup).toContain("gap:8px");
    } finally { Object.assign(tokens.typography.table, previous); tokens.spacing.base = previousBase; }
  });
});
