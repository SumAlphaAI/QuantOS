import type { Meta, StoryObj } from "@storybook/react"; import { I18nProvider, translate } from "./I18nProvider"; import { InlineAlert } from "../components/InlineAlert/InlineAlert";
function SafetyCopy({ locale }: { locale: "zh-CN" | "en" }) { return <I18nProvider locale={locale}><InlineAlert tone="warning" title={locale === "zh-CN" ? "安全文案" : "Safety copy"}>{translate(locale, "safety.offline")}</InlineAlert></I18nProvider>; }
const meta = { title: "foundation/I18nProvider", component: SafetyCopy, tags: ["autodocs"] } satisfies Meta<typeof SafetyCopy>; export default meta; type Story = StoryObj<typeof meta>;
export const Chinese: Story = { args: { locale: "zh-CN" } }; export const English: Story = { args: { locale: "en" } };
