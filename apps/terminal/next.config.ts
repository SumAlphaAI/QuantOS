import { execSync } from "node:child_process";
import { assertEnv } from "@sumalpha/config/env";
import type { NextConfig } from "next";

/**
 * 第一期 Terminal Web 应用。PRE-05 要求 Next.js 在读取配置时 fail-fast；
 * 本地先复制 env/local-*.env.example 到 apps/terminal/.env.local，部署环境由平台注入。
 *
 * F01 可复现构建：buildId 默认随机会导致产物 digest 漂移，
 * 固定为 <app>-<git commit>（CI 用 GITHUB_SHA，与 verify-reproducible-builds.mjs 的 SOURCE_DATE_EPOCH 同源）。
 */
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
  webpack(config, { webpack }) {
    // F02-A11: short-ID collision retries depend on async traversal order.
    // Use a fixed larger namespace and reject collisions instead of reassigning IDs.
    config.optimization.moduleIds = false;
    config.plugins.push(new webpack.ids.DeterministicModuleIdsPlugin({
      maxLength: 8, fixedLength: true, failOnConflict: true,
    }));
    return config;
  },
  generateBuildId: () => deterministicBuildId("terminal"),
  transpilePackages: ["@sumalpha/ui", "@sumalpha/config", "@sumalpha/domain-ui", "@sumalpha/api-client", "@sumalpha/platform"],
  // Terminal 业务路由一律 noindex, nofollow（执行计划第 2 节）：由 app/layout.tsx metadata.robots 保证
};

export default nextConfig;
