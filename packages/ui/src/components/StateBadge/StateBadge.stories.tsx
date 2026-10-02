import type { Meta, StoryObj } from "@storybook/react";
import { StateBadge } from "./StateBadge";
/** Seven baseline examples, including theme/viewport variants; full domain eight-state coverage belongs to UI-Pxx. */
const meta = { title: "ui/StateBadge", component: StateBadge, tags: ["autodocs"] } satisfies Meta<typeof StateBadge>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { state: "running" } };
export const ApprovalRequired: Story = { args: { state: "approval_required" } };
export const Denied: Story = { args: { state: "deny" } };
export const Stale: Story = { args: { state: "stale" } };
export const UnknownFallback: Story = { args: { state: "some_future_enum" } };
export const LightTheme: Story = { args: { state: "succeeded" }, globals: { theme: "light" }, parameters: { backgrounds: { default: "light" } } };
export const ReadonlyViewport: Story = { args: { state: "delayed" }, parameters: { viewport: { defaultViewport: "readonly390" } } };
