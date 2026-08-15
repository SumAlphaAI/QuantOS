import type { Metadata, Viewport } from "next";
import { SiteFooter, SiteHeader } from "./_components/site-chrome";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://sumalpha.ai";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SumAlpha QuantOS — AI 原生量化研究与交易操作系统",
    template: "%s — SumAlpha QuantOS",
  },
  description:
    "面向专业量化团队的 AI 原生操作系统：Agent 只提出建议、绝不直接下单，默认 Paper/Shadow 模式，全链路审计留证。",
  openGraph: {
    siteName: "SumAlpha QuantOS",
    locale: "zh_CN",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0E1420",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
