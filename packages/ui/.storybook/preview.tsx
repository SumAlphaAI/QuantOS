import type { Preview } from "@storybook/react";
import { I18nProvider } from "../src/i18n/I18nProvider";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import tokens from "../src/tokens/tokens.json";
import "../src/styles.css";

const preview: Preview = {
  globalTypes: {
    theme: { description: "QuantOS theme", defaultValue: "dark", toolbar: { icon: "paintbrush", items: ["dark", "light"] } },
    locale: { description: "Locale", defaultValue: "zh-CN", toolbar: { icon: "globe", items: ["zh-CN", "en"] } },
  },
  decorators: [(Story, context) => <ThemeProvider theme={context.globals.theme}><I18nProvider locale={context.globals.locale}><div style={{ width: "min(72rem, calc(100vw - 32px))", maxWidth: "calc(100vw - 32px)", padding: 16 }}><Story /></div></I18nProvider></ThemeProvider>],
  parameters: {
    layout: "centered",
    backgrounds: { default: "dark", values: [{ name: "dark", value: tokens.color.dark.surface["0"] }, { name: "light", value: tokens.color.light.surface["0"] }] },
    viewport: { viewports: {
      desktop1440: { name: "Desktop 1440", styles: { width: "1440px", height: "900px" } }, desktop1280: { name: "Desktop 1280", styles: { width: "1280px", height: "800px" } },
      collapsed768: { name: "Collapsed 768", styles: { width: "768px", height: "1024px" } }, readonly390: { name: "Readonly 390", styles: { width: "390px", height: "844px" } },
    } },
    a11y: { config: { rules: [{ id: "color-contrast", enabled: true }] } },
  },
};
export default preview;
