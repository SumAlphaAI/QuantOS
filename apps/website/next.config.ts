import type { NextConfig } from "next";

/** 官网独立应用：与 Terminal 分应用构建（执行计划第 2 节）。 */
const nextConfig: NextConfig = {
  output: "export",
  transpilePackages: ["@sumalpha/ui", "@sumalpha/config"],
};

export default nextConfig;
