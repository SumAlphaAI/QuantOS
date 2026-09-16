import type { StorybookConfig } from "@storybook/react-vite";

/**
 * PRE-02 Storybook 骨架；依赖版本已由 PRE-03 落地并进入 pnpm 锁文件。
 * 本配置冻结 UI、domain-ui 与 Terminal story 的扫描范围和可访问性插件基线。
 */
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)", "../../domain-ui/src/**/*.stories.@(ts|tsx)", "../../../apps/terminal/app/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-a11y", // axe：严重/高等级问题为 0（执行计划 7.1）
    "@storybook/addon-interactions",
  ],
  framework: { name: "@storybook/react-vite", options: {} },
  staticDirs: ["../public"],
};
export default config;
