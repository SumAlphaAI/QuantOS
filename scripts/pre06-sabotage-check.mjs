#!/usr/bin/env node
/**
 * PRE-06 破坏自检（完成标准）：故意破坏 schema、权限、敏感字段、视觉基线，
 * 逐项确认对应检查会失败（即门禁真实有效）。全部检出则本脚本通过（exit 0）。
 */
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { loadFixture, validateFixture } from "../tests/contract/validate.mjs";

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
  const issues = validateFixture(loadFixture("sabotage/schema-broken.json"), { schema: "command-center-view" });
  expectDetected("schema 破坏（缺 required 字段）", issues.length > 0, issues[0]);
}

// 2) 权限破坏：TradeProposal executable=true（违反 A02 不变量）
{
  const issues = validateFixture(loadFixture("sabotage/permission-executable.json"));
  expectDetected("权限破坏（executable=true）", issues.some((i) => i.includes("executable")), issues[0]);
}

// 3) 敏感字段破坏：注入 venueApiKey
{
  const issues = validateFixture(loadFixture("sabotage/sensitive-field.json"), { schema: "command-center-view" });
  expectDetected("敏感字段破坏（venueApiKey）", issues.some((i) => i.includes("venueApiKey")), issues[0]);
}

// 4) 视觉基线破坏：构造与基线差异 >0.5% 的图像，pixelmatch 必须检出
{
  const w = 1440, h = 900;
  const make = (fill) => {
    const png = new PNG({ width: w, height: h });
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = fill[0]; png.data[i + 1] = fill[1]; png.data[i + 2] = fill[2]; png.data[i + 3] = 255;
    }
    return png;
  };
  const baseline = make([14, 20, 32]); // surface.0 深炭
  const sabotaged = make([14, 20, 32]);
  // 破坏 5% 像素（模拟视觉回归）
  for (let i = 0; i < sabotaged.data.length * 0.05; i += 4) {
    sabotaged.data[i] = 248; sabotaged.data[i + 1] = 113; sabotaged.data[i + 2] = 113;
  }
  const diff = pixelmatch(baseline.data, sabotaged.data, null, w, h, { threshold: 0.1 });
  const ratio = diff / (w * h);
  expectDetected("视觉基线破坏（5% 像素变更）", ratio > 0.005, `diff=${(ratio * 100).toFixed(2)}% > 阈值 0.5%`);
}

if (undetected > 0) {
  console.error(`\n${undetected} 类破坏未被捕获`);
  process.exit(1);
}
console.log("\nPRE-06 破坏自检通过：四类故意破坏均被门禁捕获");
