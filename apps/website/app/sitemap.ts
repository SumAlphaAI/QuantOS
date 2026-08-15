import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://sumalpha.ai";

export const dynamic = "force-static";

const PAGES = ["", "/product", "/architecture-security", "/use-cases", "/docs", "/access-request", "/login"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date("2026-08-15"),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
