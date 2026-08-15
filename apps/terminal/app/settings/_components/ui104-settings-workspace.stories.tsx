import type { Meta, StoryObj } from "@storybook/react";

import { ui104SettingsFixture } from "../../../src/settings/fixture";
import "../../globals.css";
import { SettingsWorkspace } from "./ui104-settings-workspace";

const meta = {
  title: "terminal/UI-104 Settings Workspace",
  component: SettingsWorkspace,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "UI-104 / P15 + P17：Profile、安全、通知与 Web 浏览器能力设置。覆盖 default/loading/empty/error/unauthorized/stale/offline，并在 Security 默认态提供 DangerConfirmDialog。",
      },
    },
  },
  args: { section: "profile", initialData: ui104SettingsFixture, contractMode: "mocked", platformKind: "web", pageState: "default" },
} satisfies Meta<typeof SettingsWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = { args: { pageState: "loading" } };
export const Empty: Story = { args: { pageState: "empty" } };
export const Error: Story = { args: { pageState: "error" } };
export const Unauthorized: Story = { args: { pageState: "unauthorized" } };
export const Stale: Story = { args: { pageState: "stale" } };
export const Offline: Story = { args: { section: "security", pageState: "offline" } };
export const DangerConfirm: Story = { args: { section: "security" } };
export const BrowserCapabilities: Story = { args: { section: "browser" } };
export const MobileReadonly: Story = { args: { section: "security" }, parameters: { viewport: { defaultViewport: "readonly390" } } };
export const DesktopHidesBrowserEntry: Story = { args: { section: "profile", platformKind: "desktop" } };
