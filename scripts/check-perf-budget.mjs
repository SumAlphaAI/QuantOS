#!/usr/bin/env node
/**
 * PRE-06 性能预算校验（执行计划 7.4）。
 * 预算（G0 基线化，超限须 ADR 与拆包证据）：
 * - 共享首屏 JS gzip ≤ 250KB（全部路由首屏共同加载的 chunk + polyfills）；
 * - 单 chunk gzip ≤ 200KB；
 * - 全部 CSS gzip ≤ 60KB。
 * 共享首屏以 `.next/app-build-manifest.json` 各路由首屏 chunk 列表的交集为准，
 * 避免把按需加载的路由 page chunk 误计入共享首屏；各路由另按冻结预算阻断（含polyfills）。
 * 运行：node scripts/check-perf-budget.mjs [apps/terminal/out]
 */
import { sourceDigest } from "./pre03-build-receipt.mjs";
import { loadEffectiveConfig } from "./pre03-next-config.mjs";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, extname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const outDir = process.argv[2] ?? "apps/terminal/out";
const BUDGETS = { sharedFirstLoadJs: 250 * 1024, singleChunk: 200 * 1024, totalCss: 60 * 1024 };

if (!existsSync(outDir)) {
  console.error(`FAIL  构建产物不存在：${outDir}（先运行 build）`);
  process.exit(1);
}

const appBuildManifestPath = join(dirname(outDir), ".next", "app-build-manifest.json");
if (!existsSync(appBuildManifestPath)) {
  console.error(`FAIL  构建清单不存在：${appBuildManifestPath}（先运行 build）`);
  process.exit(1);
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const assets = walk(join(outDir, "_next"));
const gz = (p) => gzipSync(readFileSync(p)).length;
const jsChunks = assets.filter((p) => extname(p) === ".js");
const cssFiles = assets.filter((p) => extname(p) === ".css");

// 各路由首屏 chunk（app-build-manifest 路径相对 .next/，与 out/_next/ 下的布局一致）
const manifest = JSON.parse(readFileSync(appBuildManifestPath, "utf8"));
const receipt=JSON.parse(readFileSync(join(outDir,"pre03-build.json"),"utf8"));
const buildId=readFileSync(join(dirname(outDir),".next","BUILD_ID"),"utf8").trim();
if(receipt.schema!=="quantos-pre03-build/v1"||!buildId||receipt.buildId!==buildId||!receipt.sourceDigest||!['terminal','website'].includes(receipt.app)) throw new Error("Invalid or mismatched build receipt");
const projectRoot=resolve(outDir,"../../..");
if(resolve(projectRoot,"apps",receipt.app,"out")!==resolve(outDir))throw new Error("Unexpected application output location");
const effective=loadEffectiveConfig(projectRoot,receipt.app);
if(receipt.sourceDigest!==sourceDigest(projectRoot,effective.publicEnv))throw new Error("Stale build/source receipt");
if(!manifest.pages||!Object.keys(manifest.pages).length||!jsChunks.length||!cssFiles.length) throw new Error("Incomplete or empty build asset inventory");
const routes = Object.entries(manifest.pages).map(([route, files]) => [
  route,
  files.filter((f) => extname(f) === ".js").map((f) => join(outDir, "_next", f)),
]);

// 共享首屏 = 所有路由首屏的交集；polyfills 经 <script> 注入每页，一并计入
const shared = new Set(routes[0]?.[1] ?? []);
for (const [, files] of routes.slice(1)) {
  const fileSet = new Set(files);
  for (const f of shared) if (!fileSet.has(f)) shared.delete(f);
}
for (const p of jsChunks) if (/polyfills-[^/]*\.js$/.test(p)) shared.add(p);

for(const [,files] of routes) {
  if(!files.length)throw new Error("Route has no JavaScript assets");
  for(const file of files)if(!resolve(file).startsWith(resolve(outDir,"_next")+"/")||!existsSync(file))throw new Error("Invalid route asset");
}
if(!shared.size)throw new Error("Shared asset inventory is empty");
const sharedJs = [...shared].reduce((s, p) => s + gz(p), 0);
const maxChunk = jsChunks.reduce((m, p) => Math.max(m, gz(p)), 0);
const totalCss = cssFiles.reduce((s, p) => s + gz(p), 0);

let failures = 0;
const check = (label, actual, budget) => {
  const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
  if (actual <= budget) console.log(`ok    ${label}: ${kb(actual)} ≤ ${kb(budget)}`);
  else {
    failures += 1;
    console.error(`FAIL  ${label}: ${kb(actual)} > ${kb(budget)}（超限须 ADR 与拆包证据）`);
  }
};

check("共享首屏 JS gzip", sharedJs, BUDGETS.sharedFirstLoadJs);
check("单 chunk gzip", maxChunk, BUDGETS.singleChunk);
check("CSS gzip", totalCss, BUDGETS.totalCss);

const routeBudgets=JSON.parse(readFileSync(new URL('../tests/performance/budgets.json',import.meta.url),'utf8'));
const routeBudget=routeBudgets.apps[receipt.app]?.routeFirstLoadGzipBytes;
if(routeBudgets.schema!=="quantos-web-perf/v1"||!routeBudget||routeBudget>200*1024)throw new Error("Invalid route performance budget");
console.log("\n各路由首屏 JS gzip（含 polyfills；逐路由门禁）：");
for (const [route, files] of routes.sort((a, b) => a[0].localeCompare(b[0]))) {
  const routeFiles=new Set(files);
  for(const p of jsChunks)if(/polyfills-[^/]*\.js$/.test(p))routeFiles.add(p);
  const routeJs = [...routeFiles].reduce((s, p) => s + gz(p), 0);
  check("route "+route,routeJs,routeBudget);
  console.log(`  ${(routeJs / 1024).toFixed(1).padStart(6)}KB  ${route}`);
}

if (failures > 0) process.exit(1);
console.log("\n性能预算校验通过");
