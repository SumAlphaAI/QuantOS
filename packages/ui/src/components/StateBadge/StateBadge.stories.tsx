import type { Meta, StoryObj } from "@storybook/react";
import { StateBadge } from "./StateBadge";

/**
 * StateBadge 八态基准 story（PRE-02 骨架示例）。
 * 关联验收场景：ACC-GS-S1/S4（未知枚举 fail closed）。
 * 约定：领域组件须按组件清单第 3 节补齐 默认/加载/空/错误/无权/陈旧/离线/危险确认 八态。
 */
const meta = {
  title: "ui/StateBadge",
  component: StateBadge,
  tags: ["autodocs"],
} satisfies Meta<typeof StateBadge>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { state: "running", label: "运行中" } };
export const ApprovalRequired: Story = { args: { state: "approval_required", label: "需要审批" } };
export const Denied: Story = { args: { state: "deny", label: "已拒绝" } };
export const Stale: Story = { args: { state: "stale", label: "数据陈旧" } };

/** 未知枚举：显示"未知/需升级"，调用方据此阻断高风险动作（fail closed） */
export const UnknownFallback: Story = { args: { state: "some_future_enum", label: undefined } };

export const LightTheme: Story = {
  args: { state: "succeeded", label: "已完成", theme: "light" },
  parameters: { backgrounds: { default: "light" } },
};

export const ReadonlyViewport: Story = {
  args: { state: "delayed", label: "行情延迟" },
  parameters: { viewport: { defaultViewport: "readonly390" } },
};
