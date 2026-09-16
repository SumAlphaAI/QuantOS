import { execSync } from "node:child_process";
import { assertEnv } from "@sumalpha/config/env";
import type { NextConfig } from "next";

/** 官网独立应用：与 Terminal 分应用构建（执行计划 第 2 节）。
 * F01 可复现构建：buildId 固定为 website-<git commit>（同 apps/terminal/next.config.ts 说明）。 */
assertEnv(process.env);

function deterministicBuildId(app: string): string {
  const sha =
    process.env.GITHUB_SHA ??
    (() => {
      try {
        return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
      } catch {
        return "nogit";
      }
    })();
  return `${app}-${sha}`;
}

const nextConfig: NextConfig = {
  output: "export",
  generateBuildId: () => deterministicBuildId("website"),
  transpilePackages: ["@sumalpha/ui", "@sumalpha/config"],
};

export default nextConfig;
