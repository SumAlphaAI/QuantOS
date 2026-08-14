import type { Preview } from "@storybook/react";
import tokens from "../src/tokens/tokens.json";

/**
 * 全局预览约定：
 * - 双主题背景与 token 对齐（dark 默认，机构级深色）；
 * - 视觉基线视口：1280/1440、768 折叠、390 只读（执行计划 7.1 视觉层）。
 */
const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: tokens.color.dark.surface["0"] },
        { name: "light", value: tokens.color.light.surface["0"] },
      ],
    },
    viewport: {
      viewports: {
        desktop1440: { name: "Desktop 1440", styles: { width: "1440px", height: "900px" } },
        desktop1280: { name: "Desktop 1280", styles: { width: "1280px", height: "800px" } },
        collapsed768: { name: "Collapsed 768", styles: { width: "768px", height: "1024px" } },
        readonly390: { name: "Readonly 390", styles: { width: "390px", height: "844px" } },
      },
    },
    a11y: { config: { rules: [{ id: "color-contrast", enabled: true }] } },
  },
};
export default preview;
