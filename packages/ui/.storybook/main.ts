import type { StorybookConfig } from "@storybook/react-vite";

/**
 * PRE-02 Storybook 骨架。
 * 依赖（@storybook/react-vite、axe 面板、MSW addon 等）由 PRE-03 技术栈落地引入并锁定版本；
 * 本配置先行冻结目录与约定，安装后可直接运行。
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
