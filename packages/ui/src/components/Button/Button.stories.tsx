import type { Meta, StoryObj } from "@storybook/react"; import { Button } from "./Button";
const meta = { title: "ui/Button", component: Button, tags: ["autodocs"], args: { children: "执行操作" } } satisfies Meta<typeof Button>; export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {}; export const Primary: Story = { args: { variant: "primary" } }; export const Loading: Story = { args: { loading: true } }; export const Disabled: Story = { args: { disabled: true } }; export const Danger: Story = { args: { variant: "danger", children: "撤销订单" } };
