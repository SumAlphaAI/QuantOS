#!/usr/bin/env node
/**
 * PRE-06 性能预算校验（执行计划 7.4）。
 * 预算（G0 基线化，超限须 ADR 与拆包证据）：
 * - 共享首屏 JS gzip ≤ 250KB；
 * - 单 chunk gzip ≤ 200KB；
 * - 全部 CSS gzip ≤ 60KB。
 * 运行：node scripts/check-perf-budget.mjs [apps/terminal/out]
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { gzipSync } from "node:zlib";

const outDir = process.argv[2] ?? "apps/terminal/out";
const BUDGETS = { sharedFirstLoadJs: 250 * 1024, singleChunk: 200 * 1024, totalCss: 60 * 1024 };

if (!existsSync(outDir)) {
  console.error(`FAIL  构建产物不存在：${outDir}（先运行 build）`);
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

const totalJs = jsChunks.reduce((s, p) => s + gz(p), 0);
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

check("共享首屏 JS gzip", totalJs, BUDGETS.sharedFirstLoadJs);
check("单 chunk gzip", maxChunk, BUDGETS.singleChunk);
check("CSS gzip", totalCss, BUDGETS.totalCss);

if (failures > 0) process.exit(1);
console.log("\n性能预算校验通过");
