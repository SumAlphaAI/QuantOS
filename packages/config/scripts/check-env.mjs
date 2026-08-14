#!/usr/bin/env node
/**
 * PRE-05 配置校验 CLI。
 * 用法：
 *   node packages/config/scripts/check-env.mjs <env-file> [<env-file>...]   校验指定 env 文件
 *   node packages/config/scripts/check-env.mjs --examples                    校验 env/ 下四套示例
 * 任一文件不通过即非零退出（fail-fast，供 CI 与启动前检查使用）。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateEnv, parseEnvText } from "../src/env.ts";

const root = join(fileURLToPath(import.meta.url), "../../../..");
const args = process.argv.slice(2);
const files = args.includes("--examples")
  ? ["env/local-mock.env.example", "env/local-integrated.env.example", "env/staging.env.example", "env/desktop.env.example"]
  : args;

if (files.length === 0) {
  console.error("用法：check-env.mjs <env-file>... | --examples");
  process.exit(2);
}

let failed = 0;
for (const file of files) {
  const path = join(root, file);
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    console.error(`FAIL  ${file}: 文件不存在`);
    failed += 1;
    continue;
  }
  const result = validateEnv(parseEnvText(text));
  if (result.ok) {
    console.log(`ok    ${file}`);
  } else {
    failed += 1;
    for (const issue of result.issues) console.error(`FAIL  ${file}: ${issue.key}: ${issue.reason}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} 个环境文件校验失败`);
  process.exit(1);
}
console.log("\n环境配置校验全部通过");
