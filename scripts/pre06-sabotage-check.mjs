#!/usr/bin/env node
/**
 * PRE-06 破坏自检（完成标准）：故意破坏 schema、权限、敏感字段、视觉基线，
 * 逐项确认对应检查会失败（即门禁真实有效）。全部检出则本脚本通过（exit 0）。
 */
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFixture, validateFixture } from "../tests/contract/validate.mjs";
import { validateVisualBaselines } from "./check-visual-baselines.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let undetected = 0;
const expectDetected = (label, detected, detail = "") => {
  if (detected) console.log(`ok    ${label} 已被门禁捕获${detail ? `（${detail}）` : ""}`);
  else {
    undetected += 1;
    console.error(`FAIL  ${label} 未被捕获——门禁失效`);
  }
};

// 1) schema 破坏：缺 required 字段
{
  const issues = validateFixture(loadFixture("sabotage/schema-broken.json"), { schema: "SessionContext" });
  expectDetected("schema 破坏（缺 required 字段）", issues.length > 0, issues[0]);
}

// 2) 权限破坏：TradeProposal executable=true（违反 A02 不变量）
{
  const issues = validateFixture(
    { ...loadFixture("proposal/default.json"), executable: true },
    { schema: "TradeProposal" },
  );
  const executableIssue = issues.find((issue) => issue.includes("executable"));
  expectDetected("权限破坏（executable=true）", Boolean(executableIssue), executableIssue);
}

// 3) 敏感字段破坏：注入 venueApiKey
{
  const issues = validateFixture(loadFixture("sabotage/sensitive-field.json"), { schema: "SessionContext" });
  expectDetected("敏感字段破坏（venueApiKey）", issues.some((i) => i.includes("venueApiKey")), issues[0]);
}

// 4) 视觉基线破坏：篡改真实入库 PNG 的 5% 像素；完整性与像素差异 Gate 都必须检出
{
  const manifest = JSON.parse(readFileSync(join(repoRoot, "tests/e2e/visual-baselines.json"), "utf8"));
  const targetPath = join(repoRoot, manifest.entries[0].path);
  const originalBytes = readFileSync(targetPath);
  const baseline = PNG.sync.read(originalBytes);
  const sabotaged = PNG.sync.read(originalBytes);
  for (let i = 0; i < sabotaged.data.length * 0.05; i += 4) {
    sabotaged.data[i] = 248; sabotaged.data[i + 1] = 113; sabotaged.data[i + 2] = 113;
  }
  const sabotagedBytes = PNG.sync.write(sabotaged);
  const integrity = validateVisualBaselines(repoRoot, {
    readFile: (path) => resolve(path) === resolve(targetPath) ? sabotagedBytes : readFileSync(path),
  });
  expectDetected(
    "视觉基线完整性破坏",
    integrity.issues.some((issue) => issue.startsWith("sha256 mismatch:")),
    integrity.issues[0],
  );
  const diff = pixelmatch(baseline.data, sabotaged.data, null, baseline.width, baseline.height, { threshold: 0.1 });
  const ratio = diff / (baseline.width * baseline.height);
  expectDetected("视觉基线像素破坏（5% 像素变更）", ratio > manifest.maxDiffPixelRatio, `diff=${(ratio * 100).toFixed(2)}% > 阈值 0.5%`);
}

if (undetected > 0) {
  console.error(`\n${undetected} 类破坏未被捕获`);
  process.exit(1);
}
console.log("\nPRE-06 破坏自检通过：四类故意破坏均被门禁捕获");
