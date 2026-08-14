import type { NextConfig } from "next";

/**
 * Terminal 共享应用（Web + Tauri Desktop 加载同一产物）。
 * PoC 决策（ADR 20260814-pre03）：output "export" 产出静态产物，
 * Tauri 直接嵌入同一 out/ 目录，保证双端运行同一份代码与同一路由。
 */
const nextConfig: NextConfig = {
  output: "export",
  transpilePackages: ["@sumalpha/ui", "@sumalpha/domain-ui", "@sumalpha/api-client", "@sumalpha/platform"],
  // Terminal 业务路由一律 noindex, nofollow（执行计划第 2 节）：由 app/layout.tsx metadata.robots 保证
};

export default nextConfig;
